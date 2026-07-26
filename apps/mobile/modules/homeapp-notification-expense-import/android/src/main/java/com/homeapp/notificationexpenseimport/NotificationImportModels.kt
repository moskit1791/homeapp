package com.homeapp.notificationexpenseimport

import org.json.JSONObject

data class SourcePayload(
  val packageName: String,
  val displayName: String,
  val enabled: Boolean,
  val firstSeenAt: String,
  val lastSeenAt: String
) {
  fun toJson(): JSONObject = JSONObject()
    .put("packageName", packageName)
    .put("displayName", displayName)
    .put("enabled", enabled)
    .put("firstSeenAt", firstSeenAt)
    .put("lastSeenAt", lastSeenAt)

  companion object {
    fun fromJson(json: JSONObject) = SourcePayload(
      packageName = json.getString("packageName"),
      displayName = json.getString("displayName"),
      enabled = json.optBoolean("enabled", false),
      firstSeenAt = json.getString("firstSeenAt"),
      lastSeenAt = json.getString("lastSeenAt")
    )
  }
}

data class ImportSettings(
  val featureEnabled: Boolean = false,
  val reminderEnabled: Boolean = true,
  val reminderHour: Int = 21,
  val reminderMinute: Int = 0,
  val profileId: String? = null,
  val householdId: String? = null,
  val canCreate: Boolean = false,
  val authorizationExpiresAt: String? = null
) {
  fun toJson(): JSONObject = JSONObject()
    .put("featureEnabled", featureEnabled)
    .put("reminderEnabled", reminderEnabled)
    .put("reminderHour", reminderHour)
    .put("reminderMinute", reminderMinute)
    .put("profileId", profileId)
    .put("householdId", householdId)
    .put("canCreate", canCreate)
    .put("authorizationExpiresAt", authorizationExpiresAt)

  companion object {
    fun fromJson(json: JSONObject) = ImportSettings(
      featureEnabled = json.optBoolean("featureEnabled", false),
      reminderEnabled = json.optBoolean("reminderEnabled", true),
      reminderHour = json.optInt("reminderHour", 21).coerceIn(0, 23),
      reminderMinute = json.optInt("reminderMinute", 0).coerceIn(0, 59),
      profileId = json.optNullableString("profileId"),
      householdId = json.optNullableString("householdId"),
      canCreate = json.optBoolean("canCreate", false),
      authorizationExpiresAt = json.optNullableString("authorizationExpiresAt")
    )
  }
}

data class CandidatePayload(
  val sourceExternalId: String,
  val sourcePackage: String,
  val sourceAppName: String,
  val sourceNotificationKey: String?,
  val amount: String?,
  val currency: String?,
  val merchant: String?,
  val budgetAmount: String?,
  val budgetItemId: String?,
  val transactionType: String,
  val occurredAt: String,
  val receivedAt: String,
  val confidence: Double,
  val parserId: String,
  val requiresReview: Boolean,
  val rawText: String?,
  val localProfileId: String,
  val localHouseholdId: String
) {
  fun toJson(): JSONObject = JSONObject()
    .put("sourceExternalId", sourceExternalId)
    .put("sourcePackage", sourcePackage)
    .put("sourceAppName", sourceAppName)
    .put("sourceNotificationKey", sourceNotificationKey)
    .put("amount", amount)
    .put("currency", currency)
    .put("merchant", merchant)
    .put("budgetAmount", budgetAmount)
    .put("budgetItemId", budgetItemId)
    .put("transactionType", transactionType)
    .put("occurredAt", occurredAt)
    .put("receivedAt", receivedAt)
    .put("confidence", confidence)
    .put("parserId", parserId)
    .put("requiresReview", requiresReview)
    .put("rawText", rawText)
    .put("localProfileId", localProfileId)
    .put("localHouseholdId", localHouseholdId)

  companion object {
    fun fromJson(json: JSONObject) = CandidatePayload(
      sourceExternalId = json.getString("sourceExternalId"),
      sourcePackage = json.getString("sourcePackage"),
      sourceAppName = json.getString("sourceAppName"),
      sourceNotificationKey = json.optNullableString("sourceNotificationKey"),
      amount = json.optNullableString("amount"),
      currency = json.optNullableString("currency"),
      merchant = json.optNullableString("merchant"),
      budgetAmount = json.optNullableString("budgetAmount"),
      budgetItemId = json.optNullableString("budgetItemId"),
      transactionType = json.optString("transactionType", "unknown"),
      occurredAt = json.getString("occurredAt"),
      receivedAt = json.getString("receivedAt"),
      confidence = json.optDouble("confidence", 0.0),
      parserId = json.optString("parserId", "universal-v1"),
      requiresReview = json.optBoolean("requiresReview", true),
      rawText = json.optNullableString("rawText"),
      localProfileId = json.getString("localProfileId"),
      localHouseholdId = json.getString("localHouseholdId")
    )
  }
}

data class ParsedTransaction(
  val amount: String,
  val currency: String?,
  val merchant: String?,
  val transactionType: String,
  val confidence: Double,
  val requiresReview: Boolean,
  val parserId: String = "universal-v1"
)

internal fun JSONObject.optNullableString(key: String): String? =
  if (!has(key) || isNull(key)) null else optString(key).takeIf { it.isNotBlank() }
