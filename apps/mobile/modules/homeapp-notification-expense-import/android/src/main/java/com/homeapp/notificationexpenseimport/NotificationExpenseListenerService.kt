package com.homeapp.notificationexpenseimport

import android.app.Notification
import android.content.ComponentName
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import java.util.concurrent.Executors

class NotificationExpenseListenerService : NotificationListenerService() {
  companion object {
    private const val TAG = "HomeAppNotificationImport"

    @Volatile
    private var connectedInstance: NotificationExpenseListenerService? = null

    fun refreshActiveNotifications(context: android.content.Context): Boolean {
      val listener = connectedInstance
      if (listener == null) {
        requestRebind(ComponentName(context, NotificationExpenseListenerService::class.java))
        return false
      }

      return listener.scanActiveNotificationsAndWait()
    }
  }

  private val executor = Executors.newSingleThreadExecutor()
  private val repository by lazy { NotificationImportRepository(applicationContext) }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    enqueueNotification(sbn)
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    connectedInstance = this
    enqueueActiveNotifications()
  }

  override fun onListenerDisconnected() {
    if (connectedInstance === this) connectedInstance = null
    super.onListenerDisconnected()
    requestRebind(ComponentName(this, NotificationExpenseListenerService::class.java))
  }

  private fun enqueueActiveNotifications() {
    runCatching { activeNotifications?.toList().orEmpty() }
      .onSuccess { notifications -> notifications.forEach(::enqueueNotification) }
      .onFailure { error ->
        Log.w(TAG, "active notification scan failed", error)
      }
  }

  private fun scanActiveNotificationsAndWait(): Boolean = runCatching {
    val notifications = activeNotifications?.toList().orEmpty().filter(::shouldHandle)
    executor.submit {
      notifications.forEach(::processNotificationSafely)
    }.get()
    true
  }.onFailure { error ->
    Log.w(TAG, "active notification refresh failed", error)
  }.getOrDefault(false)

  private fun enqueueNotification(sbn: StatusBarNotification?) {
    if (sbn == null || !shouldHandle(sbn)) return

    executor.execute { processNotificationSafely(sbn) }
  }

  private fun shouldHandle(sbn: StatusBarNotification): Boolean =
    sbn.packageName != packageName &&
      sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY == 0

  private fun processNotificationSafely(sbn: StatusBarNotification) {
    runCatching { processNotification(sbn) }
      .onFailure { error ->
        Log.w(TAG, "notification processing failed", error)
      }
  }

  private fun processNotification(sbn: StatusBarNotification) {
    val displayName = runCatching {
      val applicationInfo = packageManager.getApplicationInfo(sbn.packageName, 0)
      packageManager.getApplicationLabel(applicationInfo).toString()
    }.getOrDefault(sbn.packageName)
    if (!repository.shouldAnalyzeNotification(sbn.packageName, displayName)) {
      return
    }
    val extras = sbn.notification.extras
    val title = listOfNotNull(
      extras.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
      extras.getCharSequence(Notification.EXTRA_TITLE_BIG)?.toString()
    )
      .distinct()
      .joinToString(" ")
      .takeIf { it.isNotBlank() }
    val text = listOfNotNull(
      extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_INFO_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)?.toString(),
      extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
        ?.joinToString(" ") { it.toString() }
    )
      .distinct()
      .joinToString(" ")
      .takeIf { it.isNotBlank() }

    repository.recordSelectedNotification(
      packageName = sbn.packageName,
      displayName = displayName,
      notificationKey = sbn.key,
      postedAt = sbn.postTime,
      title = title,
      text = text
    )
  }

  override fun onDestroy() {
    if (connectedInstance === this) connectedInstance = null
    executor.shutdown()
    super.onDestroy()
  }
}
