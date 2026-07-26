package com.homeapp.notificationexpenseimport

import android.content.Context
import android.graphics.Bitmap
import android.util.Base64
import android.util.Log
import androidx.core.graphics.drawable.toBitmap
import java.io.ByteArrayOutputStream
import java.time.Instant
import java.util.UUID

class NotificationImportRepository(context: Context) {
  companion object {
    private const val INDEX_KEY_CHECK_INPUT = "state:index-key-check:v1"
    private const val SCHEMA_VERSION = 1
    private const val TAG = "HomeAppNotificationImport"
    private const val RAW_TEXT_RETENTION_MS = 7L * 24 * 60 * 60 * 1000
    private const val PENDING_RETENTION_MS = 30L * 24 * 60 * 60 * 1000
    private const val TOMBSTONE_RETENTION_MS = 180L * 24 * 60 * 60 * 1000
  }

  private val appContext = context.applicationContext
  private val database get() = NotificationImportDatabase.get(appContext)
  private val dao get() = database.dao()
  private val crypto = QueueCrypto()
  private val parser = UniversalNotificationTransactionParser()

  fun getSettings(): ImportSettings {
    val row = dao.getState() ?: return ImportSettings()
    val json = decryptJson(row.id.toString(), row.schemaVersion, row.nonce, row.ciphertext)
    val expectedIndexKeyCheck = json.optNullableString("indexKeyCheck")
    if (
      expectedIndexKeyCheck != null &&
      expectedIndexKeyCheck != crypto.index(INDEX_KEY_CHECK_INPUT)
    ) {
      throw QueueKeyUnavailableException(IllegalStateException("Local index key check failed"))
    }
    return ImportSettings.fromJson(json)
  }

  fun saveSettings(settings: ImportSettings) {
    val now = System.currentTimeMillis()
    val settingsJson = settings.toJson()
      .put("indexKeyCheck", crypto.index(INDEX_KEY_CHECK_INPUT))
    val encrypted = encryptJson("1", settingsJson)
    dao.saveState(
      NotificationImportStateEntity(
        schemaVersion = SCHEMA_VERSION,
        nonce = encrypted.nonce,
        ciphertext = encrypted.ciphertext,
        pendingCount = countPendingFor(settings),
        updatedAt = now
      )
    )
  }

  fun updateContext(
    profileId: String,
    householdId: String,
    canCreate: Boolean,
    authorizationExpiresAt: String?
  ) {
    val current = getSettings()
    adoptLegacySources(current)
    val contextChanged =
      (current.profileId != null && current.profileId != profileId) ||
        (current.householdId != null && current.householdId != householdId)
    saveSettings(
      current.copy(
        featureEnabled = if (contextChanged) false else current.featureEnabled,
        profileId = profileId,
        householdId = householdId,
        canCreate = canCreate,
        authorizationExpiresAt = authorizationExpiresAt
      )
    )
    NotificationExpenseReminderScheduler.schedule(appContext)
    NotificationExpenseMaintenanceScheduler.schedule(appContext)
  }

  fun clearContext() {
    val current = getSettings()
    saveSettings(
      current.copy(
        featureEnabled = false,
        profileId = null,
        householdId = null,
        canCreate = false,
        authorizationExpiresAt = null
      )
    )
    NotificationExpenseReminderScheduler.cancel(appContext)
  }

  fun listSources(): List<Map<String, Any?>> {
    val settings = getSettings()
    adoptLegacySources(settings)
    val profileId = settings.profileId ?: return emptyList()
    val householdId = settings.householdId ?: return emptyList()
    return dao.listSources(
      crypto.index("profile:$profileId"),
      crypto.index("household:$householdId")
    ).map { row ->
      val payload = decryptSource(row)
      mapOf(
        "packageName" to payload.packageName,
        "displayName" to payload.displayName,
        "iconDataUrl" to resolveIconDataUrl(payload.packageName),
        "enabled" to payload.enabled,
        "firstSeenAt" to payload.firstSeenAt,
        "lastSeenAt" to payload.lastSeenAt
      )
    }
  }

  fun setSourceEnabled(packageName: String, enabled: Boolean) {
    val settings = getSettings()
    adoptLegacySources(settings)
    val profileId = settings.profileId ?: throw IllegalStateException("No active profile")
    val householdId = settings.householdId ?: throw IllegalStateException("No active household")
    val index = crypto.index("source:$packageName")
    val row = dao.findSource(
      crypto.index("profile:$profileId"),
      crypto.index("household:$householdId"),
      index
    ) ?: throw IllegalArgumentException("Notification source not found")
    val payload = decryptSource(row).copy(enabled = enabled)
    val encrypted = encryptJson(row.id, payload.toJson())
    dao.updateSource(
      row.copy(
        nonce = encrypted.nonce,
        ciphertext = encrypted.ciphertext,
        updatedAt = System.currentTimeMillis()
      )
    )
  }

  fun shouldAnalyzeNotification(
    packageName: String,
    displayName: String
  ): Boolean {
    val now = System.currentTimeMillis()
    cleanup(now)
    val settings = getSettings()
    adoptLegacySources(settings)
    val profileId = settings.profileId ?: return false
    val householdId = settings.householdId ?: return false
    val source = upsertSource(
      packageName,
      displayName,
      crypto.index("profile:$profileId"),
      crypto.index("household:$householdId"),
      now
    )
    val allowed = canCapture(settings) && source.enabled
    if (!allowed) Log.i(TAG, "notification ignored")
    return allowed
  }

  fun recordSelectedNotification(
    packageName: String,
    displayName: String,
    notificationKey: String?,
    postedAt: Long,
    title: String?,
    text: String?
  ) {
    val now = System.currentTimeMillis()
    cleanup(now)
    val settings = getSettings()
    val profileId = settings.profileId ?: return
    val householdId = settings.householdId ?: return
    val profileIndex = crypto.index("profile:$profileId")
    val householdIndex = crypto.index("household:$householdId")
    val sourceRow = dao.findSource(
      profileIndex,
      householdIndex,
      crypto.index("source:$packageName")
    ) ?: return
    val source = decryptSource(sourceRow)

    if (!canCapture(settings) || !source.enabled) {
      Log.i(TAG, "notification ignored")
      return
    }

    val parsed = parser.parse(NotificationInput(title, text))
    if (parsed == null) {
      Log.i(TAG, "candidate parsing failed")
      return
    }

    val combined = listOfNotNull(title, text).joinToString(" ")
    val sanitized = parser.sanitizeForStorage(combined)
    val normalizedText = sanitized?.lowercase()?.replace(Regex("""\s+"""), " ") ?: ""
    val notificationIndex = notificationKey?.let {
      crypto.index("notification:$packageName:$it")
    }
    val fingerprint = crypto.index(
      "fingerprint:$packageName:${notificationKey ?: ""}:${parsed.amount}:${parsed.currency ?: ""}:" +
        "${parsed.merchant ?: ""}:${postedAt / 60_000}:$normalizedText"
    )
    val existing = dao.findDuplicate(
      profileIndex,
      householdIndex,
      notificationIndex,
      fingerprint
    )

    if (existing != null && existing.status != "pending") {
      Log.i(TAG, "notification ignored")
      return
    }

    val id = existing?.id ?: UUID.randomUUID().toString()
    val previous = existing?.let(::decryptCandidate)
    val receivedAt = Instant.ofEpochMilli(now).toString()
    val payload = CandidatePayload(
      sourceExternalId = previous?.sourceExternalId ?: UUID.randomUUID().toString(),
      sourcePackage = packageName,
      sourceAppName = displayName,
      sourceNotificationKey = notificationKey,
      amount = parsed.amount,
      currency = parsed.currency,
      merchant = parsed.merchant,
      budgetAmount = previous?.budgetAmount,
      budgetItemId = previous?.budgetItemId,
      transactionType = parsed.transactionType,
      occurredAt = Instant.ofEpochMilli(postedAt).toString(),
      receivedAt = previous?.receivedAt ?: receivedAt,
      confidence = parsed.confidence,
      parserId = parsed.parserId,
      requiresReview = parsed.requiresReview,
      rawText = sanitized,
      localProfileId = profileId,
      localHouseholdId = householdId
    )
    val encrypted = encryptJson(id, payload.toJson())
    val entity = PendingTransactionEntity(
      id = id,
      notificationKeyIndex = notificationIndex,
      fingerprintIndex = fingerprint,
      profileIndex = profileIndex,
      householdIndex = householdIndex,
      status = "pending",
      schemaVersion = SCHEMA_VERSION,
      nonce = encrypted.nonce,
      ciphertext = encrypted.ciphertext,
      receivedAt = existing?.receivedAt ?: now,
      rawTextExpiresAt = now + RAW_TEXT_RETENTION_MS,
      createdAt = existing?.createdAt ?: now,
      updatedAt = now
    )

    if (existing == null) dao.insertPending(entity) else dao.updatePending(entity)
    refreshPendingCount(settings)
    NotificationExpenseReminderScheduler.schedule(appContext)
    Log.i(TAG, "notification candidate stored")
  }

  fun listPending(): List<Map<String, Any?>> {
    cleanup(System.currentTimeMillis())
    val settings = getSettings()
    val profileId = settings.profileId ?: return emptyList()
    val householdId = settings.householdId ?: return emptyList()
    val rows = dao.listPending(
      crypto.index("profile:$profileId"),
      crypto.index("household:$householdId")
    )

    return rows.map { row ->
      val value = decryptCandidate(row)
      mapOf(
        "id" to row.id,
        "sourceExternalId" to value.sourceExternalId,
        "sourcePackage" to value.sourcePackage,
        "sourceAppName" to value.sourceAppName,
        "amount" to value.amount,
        "currency" to value.currency,
        "merchant" to value.merchant,
        "budgetAmount" to value.budgetAmount,
        "budgetItemId" to value.budgetItemId,
        "transactionType" to value.transactionType,
        "occurredAt" to value.occurredAt,
        "receivedAt" to value.receivedAt,
        "confidence" to value.confidence,
        "parserId" to value.parserId,
        "requiresReview" to value.requiresReview,
        "status" to row.status
      )
    }
  }

  fun updatePending(id: String, changes: Map<String, Any?>) {
    val row = requireOwnedPending(id)
    val value = decryptCandidate(row)
    val next = value.copy(
      amount = changes.stringOrCurrent("amount", value.amount),
      currency = changes.stringOrCurrent("currency", value.currency)?.uppercase(),
      merchant = changes.stringOrCurrent("merchant", value.merchant)?.take(160),
      budgetAmount = changes.stringOrCurrent("budgetAmount", value.budgetAmount),
      budgetItemId = changes.stringOrCurrent("budgetItemId", value.budgetItemId)
    )
    val encrypted = encryptJson(id, next.toJson())
    dao.updatePending(
      row.copy(
        nonce = encrypted.nonce,
        ciphertext = encrypted.ciphertext,
        updatedAt = System.currentTimeMillis()
      )
    )
  }

  fun setStatus(id: String, status: String) {
    require(status == "ignored" || status == "imported")
    val row = requireOwnedPending(id)
    val value = decryptCandidate(row).copy(rawText = null)
    val encrypted = encryptJson(id, value.toJson())
    dao.updatePending(
      row.copy(
        status = status,
        nonce = encrypted.nonce,
        ciphertext = encrypted.ciphertext,
        rawTextExpiresAt = null,
        updatedAt = System.currentTimeMillis()
      )
    )
    val settings = getSettings()
    refreshPendingCount(settings)
    Log.i(TAG, if (status == "imported") "candidate import completed" else "notification ignored")
  }

  fun clearPending() {
    dao.clearPending()
    refreshPendingCount(getSettings())
    NotificationExpenseReminderScheduler.cancel(appContext)
  }

  fun pendingCount(): Int {
    return countPendingFor(getSettings())
  }

  fun runMaintenance() {
    cleanup(System.currentTimeMillis())
  }

  fun storageState(): Map<String, Any?> {
    val hasEncryptedData = dao.encryptedRecordCount() > 0
    if (hasEncryptedData && !crypto.keysPresent()) {
      return mapOf("state" to "unavailable", "pendingCount" to 0)
    }

    return try {
      if (!crypto.keysAvailable()) {
        return mapOf("state" to "unavailable", "pendingCount" to 0)
      }
      val settings = getSettings()
      val profileId = settings.profileId
      val householdId = settings.householdId
      if (profileId != null && householdId != null) {
        dao.listSources(
          crypto.index("profile:$profileId"),
          crypto.index("household:$householdId")
        ).firstOrNull()?.let(::decryptSource)
      }
      mapOf("state" to "available", "pendingCount" to pendingCount())
    } catch (_: Throwable) {
      mapOf("state" to "unavailable", "pendingCount" to 0)
    }
  }

  fun resetAll() {
    dao.clearPending()
    dao.clearSources()
    NotificationImportDatabase.closeForReset()
    appContext.deleteDatabase(NotificationImportDatabase.DATABASE_NAME)
    crypto.deleteKeys()
    NotificationExpenseReminderScheduler.cancel(appContext)
    NotificationExpenseMaintenanceScheduler.cancel(appContext)
  }

  private fun upsertSource(
    packageName: String,
    displayName: String,
    profileIndex: String,
    householdIndex: String,
    now: Long
  ): SourcePayload {
    val index = crypto.index("source:$packageName")
    val existing = dao.findSource(profileIndex, householdIndex, index)
    val timestamp = Instant.ofEpochMilli(now).toString()
    val payload = if (existing == null) {
      SourcePayload(packageName, displayName, false, timestamp, timestamp)
    } else {
      decryptSource(existing).copy(displayName = displayName, lastSeenAt = timestamp)
    }
    val id = existing?.id ?: UUID.randomUUID().toString()
    val encrypted = encryptJson(id, payload.toJson())
    val row = NotificationSourceEntity(
      id = id,
      packageIndex = index,
      profileIndex = profileIndex,
      householdIndex = householdIndex,
      schemaVersion = SCHEMA_VERSION,
      nonce = encrypted.nonce,
      ciphertext = encrypted.ciphertext,
      createdAt = existing?.createdAt ?: now,
      updatedAt = now
    )
    if (existing == null) dao.insertSource(row) else dao.updateSource(row)
    return payload
  }

  private fun cleanup(now: Long) {
    dao.deleteExpired(now - PENDING_RETENTION_MS, now - TOMBSTONE_RETENTION_MS)
    dao.listWithExpiredRawText(now).forEach { row ->
      runCatching {
        val value = decryptCandidate(row).copy(rawText = null)
        val encrypted = encryptJson(row.id, value.toJson())
        dao.updatePending(
          row.copy(
            nonce = encrypted.nonce,
            ciphertext = encrypted.ciphertext,
            rawTextExpiresAt = null,
            updatedAt = now
          )
        )
      }
    }
  }

  private fun adoptLegacySources(settings: ImportSettings) {
    val profileId = settings.profileId ?: return
    val householdId = settings.householdId ?: return
    dao.adoptLegacySources(
      crypto.index("profile:$profileId"),
      crypto.index("household:$householdId")
    )
  }

  private fun resolveIconDataUrl(packageName: String): String? = runCatching {
    val drawable = appContext.packageManager.getApplicationIcon(packageName)
    val bitmap = drawable.toBitmap(width = 96, height = 96, config = Bitmap.Config.ARGB_8888)
    val bytes = ByteArrayOutputStream().use { output ->
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
      output.toByteArray()
    }
    "data:image/png;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}"
  }.getOrNull()

  private fun canCapture(settings: ImportSettings): Boolean {
    val authorizationValid = settings.authorizationExpiresAt
      ?.let { runCatching { Instant.parse(it).isAfter(Instant.now()) }.getOrDefault(false) }
      ?: false
    return settings.featureEnabled &&
      settings.canCreate &&
      settings.profileId != null &&
      settings.householdId != null &&
      authorizationValid
  }

  private fun requireOwnedPending(id: String): PendingTransactionEntity {
    val row = dao.findPendingById(id) ?: throw IllegalArgumentException("Pending transaction not found")
    val settings = getSettings()
    val profileId = settings.profileId ?: throw IllegalStateException("No active profile")
    val householdId = settings.householdId ?: throw IllegalStateException("No active household")
    if (
      row.profileIndex != crypto.index("profile:$profileId") ||
      row.householdIndex != crypto.index("household:$householdId")
    ) {
      throw SecurityException("Pending transaction belongs to another local context")
    }
    return row
  }

  private fun decryptSource(row: NotificationSourceEntity): SourcePayload =
    SourcePayload.fromJson(decryptJson(row.id, row.schemaVersion, row.nonce, row.ciphertext))

  private fun decryptCandidate(row: PendingTransactionEntity): CandidatePayload =
    CandidatePayload.fromJson(decryptJson(row.id, row.schemaVersion, row.nonce, row.ciphertext))

  private fun encryptJson(id: String, value: org.json.JSONObject): EncryptedValue =
    crypto.encrypt(id, SCHEMA_VERSION, value.toString().toByteArray(Charsets.UTF_8))

  private fun decryptJson(
    id: String,
    schemaVersion: Int,
    nonce: ByteArray,
    ciphertext: ByteArray
  ): org.json.JSONObject = org.json.JSONObject(
    crypto.decrypt(id, schemaVersion, nonce, ciphertext).toString(Charsets.UTF_8)
  )

  private fun countPendingFor(settings: ImportSettings): Int {
    val profileId = settings.profileId ?: return 0
    val householdId = settings.householdId ?: return 0
    return dao.listPending(
      crypto.index("profile:$profileId"),
      crypto.index("household:$householdId")
    ).size
  }

  private fun refreshPendingCount(settings: ImportSettings) {
    val current = dao.getState()
    if (current != null) {
      dao.saveState(current.copy(pendingCount = countPendingFor(settings), updatedAt = System.currentTimeMillis()))
    }
  }
}

private fun Map<String, Any?>.stringOrCurrent(key: String, current: String?): String? {
  if (!containsKey(key)) return current
  return this[key]?.toString()?.trim()?.takeIf { it.isNotEmpty() }
}
