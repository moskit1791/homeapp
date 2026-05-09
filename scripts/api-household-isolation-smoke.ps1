param(
  [string]$BaseUrl = "http://localhost:3000/api"
)

$ErrorActionPreference = "Stop"

trap {
  Write-Error $_
  exit 1
}

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$password = "QaIsolation111@"
$today = Get-Date -Format "yyyy-MM-dd"
$nextMonth = (Get-Date).AddMonths(1).ToString("yyyy-MM-dd")
$ownerAEmail = "qa.iso.a.$stamp@homeapp.local"
$ownerBEmail = "qa.iso.b.$stamp@homeapp.local"
$marker = "QA_ISO_$stamp"
$checks = New-Object System.Collections.Generic.List[string]

function Add-Check([string]$Name) {
  $script:checks.Add($Name)
  Write-Host "OK $Name"
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

function Assert-StatusIn([int]$Status, [int[]]$Allowed, [string]$Name) {
  if ($Allowed -notcontains $Status) {
    throw "$Name returned $Status, expected one of $($Allowed -join ', ')"
  }

  Add-Check $Name
}

function Assert-NotContainsMarker($Value, [string]$Name) {
  $json = $Value | ConvertTo-Json -Depth 30 -Compress

  if ($json -like "*$marker*") {
    throw "$Name leaked marker $marker"
  }

  Add-Check $Name
}

function New-VerifiedOwner([string]$Email, [string]$HouseName) {
  $registered = Request-Json "POST" "/auth/register" @{
    displayName = $HouseName
    email = $Email
    password = $password
  }

  [void](Request-Json "POST" "/auth/verify-email" @{
    email = $Email
    token = $registered.devVerificationToken
  })

  $login = Request-Json "POST" "/auth/login" @{
    email = $Email
    password = $password
  }

  [void](Request-Json "POST" "/households" @{
    currencyCode = "PLN"
    mealSlotsPerDay = 3
    name = $HouseName
  } $login.accessToken)

  return $login.accessToken
}

$health = Request-Json "GET" "/health"
if ($health.status -ne "ok") {
  throw "Healthcheck did not return ok"
}
Add-Check "health"

$tokenA = New-VerifiedOwner $ownerAEmail "$marker Home A"
$tokenB = New-VerifiedOwner $ownerBEmail "QA_ISO_OTHER_$stamp Home B"
Add-Check "two independent households"

$houseA = Request-Json "GET" "/households/me" $null $tokenA
$houseB = Request-Json "GET" "/households/me" $null $tokenB
if ($houseA.id -eq $houseB.id) {
  throw "Two owners unexpectedly share one household"
}
Add-Check "household ids are different"

$membersA = Request-Json "GET" "/households/me/members" $null $tokenA
$ownerMemberA = @($membersA)[0]
$currentMonthA = Request-Json "GET" "/finance/current-month" $null $tokenA

$noteA = Request-Json "POST" "/notes" @{
  description = "$marker note body"
  title = "$marker note"
} $tokenA
$todoA = Request-Json "POST" "/todo-items" @{
  description = "$marker todo body"
  scopeType = "household"
  title = "$marker todo"
} $tokenA
$shoppingA = Request-Json "POST" "/shopping-lists/daily/items" @{
  name = "$marker shopping"
  quantity = "1"
} $tokenA
$calendarA = Request-Json "POST" "/calendar/events" @{
  eventDate = $today
  scopeType = "household"
  title = "$marker calendar"
} $tokenA
$dataA = Request-Json "POST" "/data-entries" @{
  title = "$marker data"
  value = "$marker secret"
} $tokenA
$cleaningA = Request-Json "POST" "/cleaning" @{
  completionWindowDays = 1
  frequencyDays = 7
  frequencyMode = "custom_days"
  name = "$marker cleaning"
  nextDueAt = $today
} $tokenA
$annualA = Request-Json "POST" "/annual-costs" @{
  defaultAmount = 10
  name = "$marker annual"
  nextDueDate = $nextMonth
} $tokenA
$categoryA = Request-Json "POST" "/finance/categories" @{
  copyBudgetToNextMonth = $false
  name = "$marker category"
} $tokenA
$budgetItemA = Request-Json "POST" "/finance/budget-items" @{
  budgetAmount = 10
  budgetMonthId = $currentMonthA.month.id
  categoryId = $categoryA.id
  name = "$marker budget"
  ownerMemberId = $ownerMemberA.id
} $tokenA
$uploadA = Request-Json "POST" "/attachments/upload-url" @{
  fileName = "$marker.pdf"
  mimeType = "application/pdf"
} $tokenA
$attachmentA = Request-Json "POST" "/attachments" @{
  caption = "$marker attachment"
  fileName = "$marker.pdf"
  mimeType = "application/pdf"
  storagePath = $uploadA.storagePath
} $tokenA
Add-Check "household A seeded private records"

Assert-NotContainsMarker (Request-Json "GET" "/notes" $null $tokenB) "notes list is isolated"
Assert-NotContainsMarker (Request-Json "GET" "/todo-items" $null $tokenB) "todo list is isolated"
Assert-NotContainsMarker (Request-Json "GET" "/shopping-lists/daily/items" $null $tokenB) "shopping list is isolated"
Assert-NotContainsMarker (Request-Json "GET" "/calendar/events?from=$today&to=$nextMonth" $null $tokenB) "calendar list is isolated"
Assert-NotContainsMarker (Request-Json "GET" "/data-entries?search=$marker" $null $tokenB) "data entries search is isolated"
Assert-NotContainsMarker (Request-Json "GET" "/cleaning" $null $tokenB) "cleaning list is isolated"
Assert-NotContainsMarker (Request-Json "GET" "/annual-costs" $null $tokenB) "annual costs list is isolated"
Assert-NotContainsMarker (Request-Json "GET" "/finance/current-month" $null $tokenB) "finance current month is isolated"
Assert-NotContainsMarker (Request-Json "GET" "/attachments?search=$marker" $null $tokenB) "attachments search is isolated"

Assert-StatusIn (Get-ErrorStatus "PATCH" "/notes/$($noteA.id)" @{ description = "cross update" } $tokenB) @(404) "cross-household note update is blocked"
Assert-StatusIn (Get-ErrorStatus "DELETE" "/todo-items/$($todoA.id)" $null $tokenB) @(404) "cross-household todo delete is blocked"
Assert-StatusIn (Get-ErrorStatus "PATCH" "/shopping-lists/items/$($shoppingA.id)" @{ quantity = "2" } $tokenB) @(404) "cross-household shopping update is blocked"
Assert-StatusIn (Get-ErrorStatus "DELETE" "/calendar/events/$($calendarA.id)" $null $tokenB) @(404) "cross-household calendar delete is blocked"
Assert-StatusIn (Get-ErrorStatus "DELETE" "/data-entries/$($dataA.id)" $null $tokenB) @(404) "cross-household data delete is blocked"
Assert-StatusIn (Get-ErrorStatus "DELETE" "/cleaning/$($cleaningA.id)" $null $tokenB) @(404) "cross-household cleaning delete is blocked"
Assert-StatusIn (Get-ErrorStatus "DELETE" "/annual-costs/$($annualA.id)" $null $tokenB) @(404) "cross-household annual cost delete is blocked"
Assert-StatusIn (Get-ErrorStatus "DELETE" "/attachments/$($attachmentA.id)" $null $tokenB) @(404) "cross-household attachment delete is blocked"
Assert-StatusIn (Get-ErrorStatus "POST" "/finance/expenses" @{ amount = 1; budgetItemId = $budgetItemA.id } $tokenB) @(400, 404) "cross-household finance expense is blocked"

[pscustomobject]@{
  baseUrl = $BaseUrl
  checks = $checks.Count
  householdA = $houseA.id
  householdB = $houseB.id
  marker = $marker
} | ConvertTo-Json -Depth 5
