package com.homeapp.notificationexpenseimport

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.util.concurrent.Executors

class NotificationExpenseListenerService : NotificationListenerService() {
  private val executor = Executors.newSingleThreadExecutor()

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (
      sbn == null ||
      sbn.packageName == packageName ||
      sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0
    ) {
      return
    }

    executor.execute {
      runCatching {
        val displayName = runCatching {
          val applicationInfo = packageManager.getApplicationInfo(sbn.packageName, 0)
          packageManager.getApplicationLabel(applicationInfo).toString()
        }.getOrDefault(sbn.packageName)
        val repository = NotificationImportRepository(applicationContext)
        if (!repository.shouldAnalyzeNotification(sbn.packageName, displayName)) {
          return@runCatching
        }
        val extras = sbn.notification.extras
        val title = extras.getCharSequence(android.app.Notification.EXTRA_TITLE)?.toString()
        val text = listOfNotNull(
          extras.getCharSequence(android.app.Notification.EXTRA_TEXT)?.toString(),
          extras.getCharSequence(android.app.Notification.EXTRA_BIG_TEXT)?.toString()
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
    }
  }

  override fun onDestroy() {
    executor.shutdown()
    super.onDestroy()
  }
}
