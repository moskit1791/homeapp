package com.homeapp.notificationexpenseimport

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.time.Duration
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit

object NotificationExpenseReminderScheduler {
  private const val WORK_NAME = "homeapp-notification-expense-review-reminder"

  fun schedule(context: Context) {
    val settings = runCatching { NotificationImportRepository(context).getSettings() }.getOrNull()
      ?: return
    if (!settings.reminderEnabled || settings.profileId == null || settings.householdId == null) {
      cancel(context)
      return
    }

    val now = ZonedDateTime.now()
    var next = now
      .withHour(settings.reminderHour)
      .withMinute(settings.reminderMinute)
      .withSecond(0)
      .withNano(0)
    if (!next.isAfter(now)) next = next.plusDays(1)
    val delay = Duration.between(now, next).toMillis().coerceAtLeast(1)
    val request = OneTimeWorkRequestBuilder<NotificationExpenseReminderWorker>()
      .setInitialDelay(delay, TimeUnit.MILLISECONDS)
      .build()

    WorkManager.getInstance(context).enqueueUniqueWork(
      WORK_NAME,
      ExistingWorkPolicy.REPLACE,
      request
    )
  }

  fun cancel(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
  }
}

object NotificationExpenseMaintenanceScheduler {
  private const val WORK_NAME = "homeapp-notification-expense-maintenance"

  fun schedule(context: Context) {
    val request = PeriodicWorkRequestBuilder<NotificationExpenseMaintenanceWorker>(
      24,
      TimeUnit.HOURS
    ).build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
      WORK_NAME,
      ExistingPeriodicWorkPolicy.KEEP,
      request
    )
  }

  fun cancel(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
  }
}

class NotificationExpenseMaintenanceWorker(
  appContext: Context,
  params: WorkerParameters
) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    return try {
      NotificationImportRepository(applicationContext).runMaintenance()
      Result.success()
    } catch (_: Throwable) {
      Result.retry()
    }
  }
}

class NotificationExpenseReminderWorker(
  appContext: Context,
  params: WorkerParameters
) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    return try {
      val repository = NotificationImportRepository(applicationContext)
      val settings = repository.getSettings()
      val count = repository.pendingCount()
      if (settings.reminderEnabled && count > 0) showNotification(count)
      NotificationExpenseReminderScheduler.schedule(applicationContext)
      Result.success()
    } catch (_: QueueKeyUnavailableException) {
      Result.success()
    } catch (_: Throwable) {
      Result.retry()
    }
  }

  private fun showNotification(count: Int) {
    if (
      Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return
    }

    val manager = applicationContext.getSystemService(NotificationManager::class.java)
    val channelId = "finance-import-review"
    if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(
        NotificationChannel(
          channelId,
          applicationContext.getString(R.string.notification_expense_channel_name),
          NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
          lockscreenVisibility = Notification.VISIBILITY_PRIVATE
          description = "Prywatne przypomnienia o transakcjach oczekujących na przypisanie"
        }
      )
    }

    val launchIntent = applicationContext.packageManager
      .getLaunchIntentForPackage(applicationContext.packageName)
      ?.apply {
        action = Intent.ACTION_VIEW
        data = Uri.parse("homeapp:///notification-expense-import")
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      ?: return
    val pendingIntent = PendingIntent.getActivity(
      applicationContext,
      4261,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val text = "Masz $count płatności do przypisania. Otwórz HomeApp, aby je sprawdzić."
    val notification = if (Build.VERSION.SDK_INT >= 26) {
      Notification.Builder(applicationContext, channelId)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(applicationContext)
    }
      .setSmallIcon(R.drawable.ic_notification_expense)
      .setContentTitle("HomeApp")
      .setContentText(text)
      .setStyle(Notification.BigTextStyle().bigText(text))
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .setCategory(Notification.CATEGORY_REMINDER)
      .build()

    manager.notify(4261, notification)
  }
}

class NotificationExpenseReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val pendingResult = goAsync()
    Thread {
      try {
        NotificationExpenseReminderScheduler.schedule(context.applicationContext)
        NotificationExpenseMaintenanceScheduler.schedule(context.applicationContext)
      } finally {
        pendingResult.finish()
      }
    }.start()
  }
}
