package com.homeapp.notificationexpenseimport

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking

class NotificationExpenseImportModule : Module() {
  private val context
    get() = requireNotNull(appContext.reactContext?.applicationContext) {
      "Android application context is unavailable"
    }
  private val repository get() = NotificationImportRepository(context)

  override fun definition() = ModuleDefinition {
    Name("HomeAppNotificationExpenseImport")

    AsyncFunction("getAccessStatus") {
      io {
        val granted = hasNotificationAccess()
        val connected = granted && NotificationExpenseListenerService.ensureConnected(context)
        mapOf(
          "granted" to granted,
          "connected" to connected
        )
      }
    }

    AsyncFunction("openAccessSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    }

    AsyncFunction("openBackgroundSettings") {
      val packageName = context.packageName
      val candidates = listOf(
        Intent("miui.intent.action.OP_AUTO_START")
          .setClassName(
            "com.miui.securitycenter",
            "com.miui.permcenter.autostart.AutoStartManagementActivity"
          ),
        Intent("miui.intent.action.APP_PERM_EDITOR")
          .setClassName(
            "com.miui.securitycenter",
            "com.miui.permcenter.permissions.PermissionsEditorActivity"
          )
          .putExtra("extra_pkgname", packageName),
        Intent(
          Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          Uri.parse("package:$packageName")
        )
      )
      val intent = candidates.firstOrNull {
        it.resolveActivity(context.packageManager) != null
      } ?: return@AsyncFunction false
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    }

    AsyncFunction("getStorageState") {
      io { repository.storageState() }
    }

    AsyncFunction("listDetectedSources") {
      io { repository.listSources() }
    }

    AsyncFunction("refreshActiveNotifications") {
      NotificationExpenseListenerService.refreshActiveNotifications(context)
    }

    AsyncFunction("setSourceEnabled") { packageName: String, enabled: Boolean ->
      io { repository.setSourceEnabled(packageName, enabled) }
      if (enabled) NotificationExpenseListenerService.refreshActiveNotifications(context)
      true
    }

    AsyncFunction("getSettings") {
      io {
        val value = repository.getSettings()
        mapOf(
          "featureEnabled" to value.featureEnabled,
          "reminderEnabled" to value.reminderEnabled,
          "reminderHour" to value.reminderHour,
          "reminderMinute" to value.reminderMinute,
          "pendingCount" to repository.pendingCount()
        )
      }
    }

    AsyncFunction("setFeatureEnabled") { enabled: Boolean ->
      io {
        val current = repository.getSettings()
        repository.saveSettings(current.copy(featureEnabled = enabled))
      }
      if (enabled) NotificationExpenseListenerService.refreshActiveNotifications(context)
      true
    }

    AsyncFunction("setReminderSettings") { enabled: Boolean, hour: Int, minute: Int ->
      require(hour in 0..23 && minute in 0..59)
      io {
        val current = repository.getSettings()
        repository.saveSettings(
          current.copy(
            reminderEnabled = enabled,
            reminderHour = hour,
            reminderMinute = minute
          )
        )
        NotificationExpenseReminderScheduler.schedule(context)
      }
      true
    }

    AsyncFunction("setCaptureContext") {
        profileId: String,
        householdId: String,
        canCreate: Boolean,
        authorizationExpiresAt: String? ->
      io {
        repository.updateContext(profileId, householdId, canCreate, authorizationExpiresAt)
      }
      true
    }

    AsyncFunction("clearCaptureContext") {
      io { repository.clearContext() }
      true
    }

    AsyncFunction("listPending") {
      io { repository.listPending() }
    }

    AsyncFunction("updatePending") { id: String, changes: Map<String, Any?> ->
      io { repository.updatePending(id, changes) }
      true
    }

    AsyncFunction("ignorePending") { id: String ->
      io { repository.setStatus(id, "ignored") }
      true
    }

    AsyncFunction("markImported") { id: String ->
      io { repository.setStatus(id, "imported") }
      true
    }

    AsyncFunction("clearPending") {
      io { repository.clearPending() }
      true
    }

    AsyncFunction("getPendingCount") {
      io { repository.pendingCount() }
    }

    AsyncFunction("resetUnavailableStorage") {
      io { repository.resetAll() }
      true
    }
  }

  private fun hasNotificationAccess(): Boolean {
    val component = ComponentName(
      context,
      NotificationExpenseListenerService::class.java
    )
    val enabled = Settings.Secure.getString(
      context.contentResolver,
      "enabled_notification_listeners"
    ) ?: return false

    return enabled.split(':')
      .mapNotNull(ComponentName::unflattenFromString)
      .any { it == component }
  }

  private fun <T> io(block: () -> T): T = runBlocking(Dispatchers.IO) { block() }
}
