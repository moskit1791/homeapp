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

private const val ACTION_OPEN_QUICK_ACTION = "com.homeapp.mobile.widget.OPEN_QUICK_ACTION"
private const val EXTRA_TARGET = "target"
private const val TARGET_NOTE = "note"
private const val TARGET_EVENT = "event"
private const val TARGET_EXPENSE = "expense"
private const val TARGET_SHOPPING = "shopping"
private const val TARGET_TODO = "todo"

data class WidgetActionBinding(
  val requestIndex: Int,
  val target: String,
  val viewId: Int
)

open class HomeActionWidgetProvider protected constructor(
  private val layoutResId: Int,
  private val actions: List<WidgetActionBinding>
) : AppWidgetProvider() {
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

  private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
    val views = RemoteViews(context.packageName, layoutResId)

    actions.forEach { action ->
      bindQuickAction(context, views, appWidgetId, action)
    }

    appWidgetManager.updateAppWidget(appWidgetId, views)
  }

  private fun bindQuickAction(
    context: Context,
    views: RemoteViews,
    appWidgetId: Int,
    action: WidgetActionBinding
  ) {
    val intent = Intent(context, javaClass).apply {
      this.action = ACTION_OPEN_QUICK_ACTION
      putExtra(EXTRA_TARGET, action.target)
      putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
    }
    val requestCode = appWidgetId * 100 + action.requestIndex
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or immutablePendingIntentFlag()
    val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags)

    views.setOnClickPendingIntent(action.viewId, pendingIntent)
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

class HomeQuickActionsWidgetProvider : HomeActionWidgetProvider(
  R.layout.home_quick_actions_widget,
  listOf(
    WidgetActionBinding(1, TARGET_NOTE, R.id.widget_action_note),
    WidgetActionBinding(2, TARGET_EVENT, R.id.widget_action_event),
    WidgetActionBinding(3, TARGET_EXPENSE, R.id.widget_action_expense),
    WidgetActionBinding(4, TARGET_SHOPPING, R.id.widget_action_shopping),
    WidgetActionBinding(5, TARGET_TODO, R.id.widget_action_todo)
  )
)

class HomeNoteWidgetProvider : HomeActionWidgetProvider(
  R.layout.home_widget_note,
  singleAction(TARGET_NOTE)
)

class HomeEventWidgetProvider : HomeActionWidgetProvider(
  R.layout.home_widget_event,
  singleAction(TARGET_EVENT)
)

class HomeExpenseWidgetProvider : HomeActionWidgetProvider(
  R.layout.home_widget_expense,
  singleAction(TARGET_EXPENSE)
)

class HomeShoppingWidgetProvider : HomeActionWidgetProvider(
  R.layout.home_widget_shopping,
  singleAction(TARGET_SHOPPING)
)

class HomeTodoWidgetProvider : HomeActionWidgetProvider(
  R.layout.home_widget_todo,
  singleAction(TARGET_TODO)
)

private fun singleAction(target: String): List<WidgetActionBinding> =
  listOf(WidgetActionBinding(1, target, R.id.widget_single_root))
