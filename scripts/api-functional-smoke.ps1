param(
  [string]$BaseUrl = "http://localhost:3000/api"
)

$ErrorActionPreference = "Stop"

trap {
  Write-Error $_
  exit 1
}

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$ownerEmail = "qa.owner.$stamp@homeapp.local"
$memberEmail = "qa.member.$stamp@homeapp.local"
$password = "QaSmoke111@"
$today = Get-Date -Format "yyyy-MM-dd"
$year = (Get-Date).Year
$nextWeek = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
$nextMonth = (Get-Date).AddMonths(1).ToString("yyyy-MM-dd")
$checks = New-Object System.Collections.Generic.List[string]

function Add-Check([string]$Name) {
  $script:checks.Add($Name)
  Write-Host "OK $Name"
}

function Get-WeekMonday {
  $now = Get-Date
  $offset = ([int]$now.DayOfWeek + 6) % 7
  return $now.AddDays(-$offset).ToString("yyyy-MM-dd")
}

function Request-Json(
  [string]$Method,
  [string]$Path,
  $Body = $null,
  [string]$Token = $null
) {
  $headers = @{}

  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }

  $params = @{
    Headers = $headers
    Method = $Method
    TimeoutSec = 20
    Uri = "$BaseUrl$Path"
  }

  if ($null -ne $Body) {
    $params["Body"] = ($Body | ConvertTo-Json -Depth 20)
    $params["ContentType"] = "application/json"
  }

  Invoke-RestMethod @params
}

function Get-ErrorStatus(
  [string]$Method,
  [string]$Path,
  $Body = $null,
  [string]$Token = $null
) {
  try {
    [void](Request-Json $Method $Path $Body $Token)
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      return [int]$_.Exception.Response.StatusCode
    }

    throw
  }

  throw "Expected HTTP error for $Method $Path"
}

$health = Request-Json "GET" "/health"
if ($health.status -ne "ok") {
  throw "Healthcheck did not return ok"
}
Add-Check "health"

$unauthorizedStatus = Get-ErrorStatus "GET" "/start/dashboard"
if ($unauthorizedStatus -ne 401) {
  throw "Expected 401 without token, got $unauthorizedStatus"
}
Add-Check "unauthorized private endpoint returns 401"

$ownerRegister = Request-Json "POST" "/auth/register" @{
  displayName = "QA Owner"
  email = $ownerEmail
  password = $password
}
if (-not $ownerRegister.devVerificationToken) {
  throw "Owner verification token missing in dev mode"
}
Add-Check "owner registration"

[void](Request-Json "POST" "/auth/verify-email" @{
  email = $ownerEmail
  token = $ownerRegister.devVerificationToken
})
Add-Check "owner email verification"

$ownerLogin = Request-Json "POST" "/auth/login" @{
  email = $ownerEmail
  password = $password
}
$ownerToken = $ownerLogin.accessToken
if (-not $ownerToken) {
  throw "Owner access token missing"
}
Add-Check "owner login"

$invalidLoginStatus = Get-ErrorStatus "POST" "/auth/login" @{
  email = $ownerEmail
  password = "Wrong111@"
}
if ($invalidLoginStatus -ne 401) {
  throw "Expected invalid login 401, got $invalidLoginStatus"
}
Add-Check "invalid login returns 401"

$householdCreate = Request-Json "POST" "/households" @{
  currencyCode = "PLN"
  mealSlotsPerDay = 3
  name = "QA Dom $stamp"
} $ownerToken
if (-not $householdCreate.household.id) {
  throw "Household id missing"
}
Add-Check "household creation"

$household = Request-Json "GET" "/households/me" $null $ownerToken
if ($household.name -notlike "QA Dom*") {
  throw "Household fetch mismatch"
}
Add-Check "household fetch"

$members = Request-Json "GET" "/households/me/members" $null $ownerToken
$ownerMember = @($members | Where-Object { $_.email -eq $ownerEmail })[0]
if (-not $ownerMember.id) {
  throw "Owner member id missing"
}
Add-Check "members list"

$permissions = Request-Json "GET" "/households/me/permissions" $null $ownerToken
if (-not (@($permissions).Count -gt 0)) {
  throw "Permissions list empty"
}
Add-Check "permissions list"

$invite = Request-Json "POST" "/households/me/invitations" @{
  email = $memberEmail
} $ownerToken
if (-not $invite.token) {
  throw "Invitation token missing"
}
Add-Check "invitation creation"

$memberRegister = Request-Json "POST" "/auth/register" @{
  displayName = "QA Member"
  email = $memberEmail
  password = $password
}
[void](Request-Json "POST" "/auth/verify-email" @{
  email = $memberEmail
  token = $memberRegister.devVerificationToken
})
$memberLogin = Request-Json "POST" "/auth/login" @{
  email = $memberEmail
  password = $password
}
$memberToken = $memberLogin.accessToken
[void](Request-Json "POST" "/invitations/accept" @{ token = $invite.token } $memberToken)
Add-Check "invitation accept by second user"

$membersAfterInvite = Request-Json "GET" "/households/me/members" $null $ownerToken
$memberRecord = @($membersAfterInvite | Where-Object { $_.email -eq $memberEmail })[0]
if (-not $memberRecord.id) {
  throw "Accepted member not visible"
}
Add-Check "accepted member visible"

$dashboard = Request-Json "GET" "/start/dashboard" $null $ownerToken
if ($null -eq $dashboard.finance) {
  throw "Dashboard finance missing"
}
Add-Check "start dashboard"

$currentMonth = Request-Json "GET" "/finance/current-month" $null $ownerToken
$monthId = $currentMonth.month.id
if (-not $monthId) {
  throw "Current month id missing"
}
Add-Check "finance current month"

$category = Request-Json "POST" "/finance/categories" @{
  copyBudgetToNextMonth = $true
  displayOrder = 900
  name = "QA Kategoria $stamp"
} $ownerToken
$item = Request-Json "POST" "/finance/budget-items" @{
  budgetAmount = 123.45
  budgetMonthId = $monthId
  categoryId = $category.id
  displayOrder = 1
  name = "QA Budzet"
  ownerMemberId = $ownerMember.id
} $ownerToken
$expense = Request-Json "POST" "/finance/expenses" @{
  amount = 23.45
  budgetItemId = $item.id
} $ownerToken
[void](Request-Json "PUT" "/finance/incomes/$($ownerMember.id)" @{ amount = 1000 } $ownerToken)
$financeAfter = Request-Json "GET" "/finance/current-month" $null $ownerToken
if ([decimal]$financeAfter.summary.totalSpentAmount -lt 23.45) {
  throw "Finance spent summary did not update"
}
Add-Check "finance category budget expense income summary"

$expenseInvalidStatus = Get-ErrorStatus "POST" "/finance/expenses" @{
  amount = 0
  budgetItemId = $item.id
} $ownerToken
if ($expenseInvalidStatus -ne 400) {
  throw "Expected invalid expense 400, got $expenseInvalidStatus"
}
Add-Check "finance validation returns 400"

$shoppingLists = Request-Json "GET" "/shopping-lists" $null $ownerToken
if (@($shoppingLists).Count -lt 2) {
  throw "Expected default shopping lists"
}
$shoppingItem = Request-Json "POST" "/shopping-lists/daily/items" @{
  displayOrder = 1
  name = "QA mleko"
  quantity = "2 szt"
} $ownerToken
$shoppingChecked = Request-Json "POST" "/shopping-lists/items/$($shoppingItem.id)/check" $null $ownerToken
if (-not $shoppingChecked.isChecked) {
  throw "Shopping check did not set isChecked"
}
Add-Check "shopping list create and check"

$weekMonday = Get-WeekMonday
$copyWeekMonday = ([datetime]$weekMonday).AddDays(7).ToString("yyyy-MM-dd")
$idea = Request-Json "POST" "/meal-ideas" @{
  linkUrl = "https://example.com/przepis"
  note = "Smoke"
  title = "QA Makaron"
} $ownerToken
$plan = Request-Json "POST" "/meal-plans" @{ weekStartDate = $weekMonday } $ownerToken
$planId = $plan.week.id
$planUpdated = Request-Json "PATCH" "/meal-plans/$planId" @{
  entries = @(
    @{
      linkUrl = "https://example.com/przepis"
      mealName = "QA Makaron"
      note = "Smoke"
      slotIndex = 0
      weekday = 1
    }
  )
} $ownerToken
$currentPlan = Request-Json "GET" "/meal-plans/current" $null $ownerToken
$randomMeal = Request-Json "POST" "/meal-plans/randomize" @{
  slotIndex = 0
  weekday = 1
} $ownerToken
$copiedPlan = Request-Json "POST" "/meal-plans/$planId/copy" @{
  targetWeekStartDate = $copyWeekMonday
} $ownerToken
if (-not $idea.id -or -not $planUpdated.week.id -or -not $currentPlan.week.id -or $null -eq $randomMeal.suggestions -or -not $copiedPlan.week.id) {
  throw "Meal planner smoke failed"
}
Add-Check "meal planner ideas plan update current randomize copy"

$event = Request-Json "POST" "/calendar/events" @{
  eventDate = $today
  eventTime = "12:30"
  note = "Smoke"
  scopeType = "household"
  title = "QA wydarzenie"
} $ownerToken
$upcoming = Request-Json "GET" "/calendar/upcoming?limit=5" $null $ownerToken
$events = Request-Json "GET" "/calendar/events?from=$today&to=$nextWeek" $null $ownerToken
if (-not $event.id -or @($upcoming).Count -lt 1 -or @($events).Count -lt 1) {
  throw "Calendar smoke failed"
}
Add-Check "calendar create list upcoming"

$todo = Request-Json "POST" "/todo-items" @{
  description = "Smoke"
  scopeType = "household"
  title = "QA zadanie"
} $ownerToken
$todoDone = Request-Json "POST" "/todo-items/$($todo.id)/done" $null $ownerToken
$todoReopen = Request-Json "POST" "/todo-items/$($todo.id)/reopen" $null $ownerToken
if ($todoDone.status -ne "done" -or $todoReopen.status -ne "todo") {
  throw "Todo status flow failed"
}
Add-Check "todo create done reopen"

$note = Request-Json "POST" "/notes" @{
  description = "Smoke"
  title = "QA notatka"
} $ownerToken
$noteUpdated = Request-Json "PATCH" "/notes/$($note.id)" @{ description = "Smoke update" } $ownerToken
$notes = Request-Json "GET" "/notes" $null $ownerToken
if (-not $noteUpdated.id -or @($notes).Count -lt 1) {
  throw "Notes smoke failed"
}
Add-Check "notes create update list"

$cleaning = Request-Json "POST" "/cleaning" @{
  completionWindowDays = 2
  frequencyDays = 7
  frequencyMode = "custom_days"
  name = "QA odkurzanie"
  nextDueAt = $today
} $ownerToken
$cleaningDone = Request-Json "POST" "/cleaning/$($cleaning.id)/complete" @{
  completedAt = $today
} $ownerToken
$cleaningHistory = Request-Json "GET" "/cleaning/$($cleaning.id)/history" $null $ownerToken
if (-not $cleaningDone.id -or @($cleaningHistory).Count -lt 1) {
  throw "Cleaning smoke failed"
}
Add-Check "cleaning create complete history"

$annual = Request-Json "POST" "/annual-costs" @{
  defaultAmount = 250
  name = "QA OC"
  nextDueDate = $nextMonth
} $ownerToken
$annualDone = Request-Json "POST" "/annual-costs/$($annual.id)/complete" @{
  amount = 250
  executedAt = $today
} $ownerToken
$annualHistory = Request-Json "GET" "/annual-costs/history?year=$year" $null $ownerToken
if (-not $annualDone.history.id -or @($annualHistory).Count -lt 1) {
  throw "Annual costs smoke failed"
}
Add-Check "annual costs create complete history"

$dataEntry = Request-Json "POST" "/data-entries" @{
  title = "QA numer"
  value = "ABC-123"
} $ownerToken
$dataSearch = Request-Json "GET" "/data-entries?search=ABC" $null $ownerToken
$dataUpdated = Request-Json "PATCH" "/data-entries/$($dataEntry.id)" @{ value = "ABC-456" } $ownerToken
if (-not $dataUpdated.id -or @($dataSearch).Count -lt 1) {
  throw "Data entries smoke failed"
}
Add-Check "data entries create search update"

$upload = Request-Json "POST" "/attachments/upload-url" @{
  fileName = "qa.pdf"
  mimeType = "application/pdf"
} $ownerToken
$attachment = Request-Json "POST" "/attachments" @{
  caption = "QA dokument"
  fileName = "qa.pdf"
  mimeType = "application/pdf"
  storagePath = $upload.storagePath
} $ownerToken
$attachments = Request-Json "GET" "/attachments?search=dokument" $null $ownerToken
if (-not $attachment.id -or @($attachments).Count -lt 1) {
  throw "Attachments smoke failed"
}
Add-Check "attachments contract create search"

[void](Request-Json "DELETE" "/notes/$($note.id)" $null $ownerToken)
[void](Request-Json "DELETE" "/todo-items/$($todo.id)" $null $ownerToken)
[void](Request-Json "DELETE" "/shopping-lists/items/$($shoppingItem.id)" $null $ownerToken)
[void](Request-Json "DELETE" "/finance/expenses/$($expense.id)" $null $ownerToken)
[void](Request-Json "DELETE" "/finance/budget-items/$($item.id)" $null $ownerToken)
[void](Request-Json "DELETE" "/meal-ideas/$($idea.id)" $null $ownerToken)
[void](Request-Json "DELETE" "/calendar/events/$($event.id)" $null $ownerToken)
[void](Request-Json "DELETE" "/cleaning/$($cleaning.id)" $null $ownerToken)
[void](Request-Json "DELETE" "/annual-costs/$($annual.id)" $null $ownerToken)
[void](Request-Json "DELETE" "/data-entries/$($dataEntry.id)" $null $ownerToken)
[void](Request-Json "DELETE" "/attachments/$($attachment.id)" $null $ownerToken)
Add-Check "cleanup created records"

[void](Request-Json "DELETE" "/households/me/members/$($memberRecord.id)" $null $ownerToken)
$removedStatus = Get-ErrorStatus "GET" "/start/dashboard" $null $memberToken
if ($removedStatus -ne 403) {
  throw "Expected removed member 403, got $removedStatus"
}
Add-Check "removed member loses household access"

[void](Request-Json "POST" "/auth/logout" $null $ownerToken)
Add-Check "auth logout"

[pscustomobject]@{
  baseUrl = $BaseUrl
  checks = $checks.Count
  memberEmail = $memberEmail
  ownerEmail = $ownerEmail
} | ConvertTo-Json -Depth 5
