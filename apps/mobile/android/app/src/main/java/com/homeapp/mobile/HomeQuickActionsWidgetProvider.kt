package com.homeapp.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class HomeQuickActionsWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    appWidgetIds.forEach { appWidgetId ->
      updateWidget(context, appWidgetManager, appWidgetId)
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)

    if (intent.action != ACTION_OPEN_QUICK_ACTION) {
      return
    }

    val target = intent.getStringExtra(EXTRA_TARGET) ?: return
    openQuickAction(context, target)
  }

  companion object {
    private const val ACTION_OPEN_QUICK_ACTION = "com.homeapp.mobile.widget.OPEN_QUICK_ACTION"
    private const val EXTRA_TARGET = "target"
    private const val TARGET_NOTE = "note"
    private const val TARGET_EVENT = "event"
    private const val TARGET_EXPENSE = "expense"
    private const val TARGET_SHOPPING = "shopping"
    private const val TARGET_TODO = "todo"

    private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
      val views = RemoteViews(context.packageName, R.layout.home_quick_actions_widget)

      bindQuickAction(context, views, appWidgetId, R.id.widget_action_note, TARGET_NOTE, 1)
      bindQuickAction(context, views, appWidgetId, R.id.widget_action_event, TARGET_EVENT, 2)
      bindQuickAction(context, views, appWidgetId, R.id.widget_action_expense, TARGET_EXPENSE, 3)
      bindQuickAction(context, views, appWidgetId, R.id.widget_action_shopping, TARGET_SHOPPING, 4)
      bindQuickAction(context, views, appWidgetId, R.id.widget_action_todo, TARGET_TODO, 5)

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun bindQuickAction(
      context: Context,
      views: RemoteViews,
      appWidgetId: Int,
      viewId: Int,
      target: String,
      actionIndex: Int
    ) {
      val intent = Intent(context, HomeQuickActionsWidgetProvider::class.java).apply {
        action = ACTION_OPEN_QUICK_ACTION
        putExtra(EXTRA_TARGET, target)
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
      }
      val requestCode = appWidgetId * 10 + actionIndex
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or immutablePendingIntentFlag()
      val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags)

      views.setOnClickPendingIntent(viewId, pendingIntent)
    }

    private fun openQuickAction(context: Context, target: String) {
      val now = System.currentTimeMillis()
      val today = todayIso()
      val route = when (target) {
        TARGET_NOTE -> "homeapp://zadania?segment=notes&action=note&intent=$now"
        TARGET_EVENT -> "homeapp://kalendarz?action=create&date=$today&intent=$now"
        TARGET_EXPENSE -> "homeapp://finanse?action=expense&intent=$now"
        TARGET_SHOPPING -> "homeapp://lista?segment=shopping&action=addShopping&intent=$now"
        TARGET_TODO -> "homeapp://zadania?segment=todo&action=todo&intent=$now"
        else -> "homeapp://"
      }
      val launchIntent = Intent(Intent.ACTION_VIEW, Uri.parse(route), context, MainActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
      }

      context.startActivity(launchIntent)
    }

    private fun todayIso(): String {
      val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)

      return formatter.format(Calendar.getInstance().time)
    }

    private fun immutablePendingIntentFlag(): Int =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
  }
}
