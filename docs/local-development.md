# Local Development

## PowerShell

Na tym komputerze używaj `pnpm.cmd`, bo PowerShell blokuje `pnpm.ps1`.

```powershell
pnpm.cmd install
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd build
pnpm.cmd test
```

## PostgreSQL

Lokalnie działa PostgreSQL 18 jako usługa `postgresql-x64-18`.
`psql` nie jest dodany do PATH, więc używaj pełnej ścieżki:

```powershell
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
```

Utwórz bazę `homeapp_dev` i ustaw connection string zgodny z `apps/api/.env.example`:

```powershell
$env:PGPASSWORD='<haslo-superusera-postgres>'
& $psql -h localhost -U postgres -d postgres -c "create database homeapp_dev"
$env:DATABASE_URL="postgres://postgres:<haslo-superusera-postgres>@localhost:5432/homeapp_dev"
pnpm.cmd --filter @homeapp/api db:migrate
```

Jeśli hasło lub port są inne, dopasuj `DATABASE_URL`.

## API

```powershell
$env:DATABASE_URL='postgres://postgres:<haslo-url-encoded>@localhost:5432/homeapp_dev'
$env:JWT_ACCESS_SECRET='dev-access-secret-change-me-minimum-32'
$env:JWT_REFRESH_SECRET='dev-refresh-secret-change-me-minimum-32'
$env:AUTH_LINK_BASE_URL='homeapp://auth'
$env:AUTH_RATE_LIMIT_MAX='20'
$env:AUTH_RATE_LIMIT_WINDOW_SECONDS='60'
$env:GOOGLE_OAUTH_CLIENT_ID=''
$env:MAIL_DRIVER='console'
pnpm.cmd --filter @homeapp/api db:migrate
pnpm.cmd --filter @homeapp/api dev
```

Smoke endpoint:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

W trybie developerskim `MAIL_DRIVER=console` loguje wiadomosci auth w backendzie. Do testu produkcyjnego ustaw:

```powershell
$env:MAIL_DRIVER='smtp'
$env:SMTP_HOST='<host-smtp>'
$env:SMTP_PORT='587'
$env:SMTP_SECURE='false'
$env:SMTP_FROM='HomeApp <noreply@twoja-domena.pl>'
$env:SMTP_USER='<user>'
$env:SMTP_PASSWORD='<password>'
```

## Mobile

```powershell
$env:EXPO_PUBLIC_API_URL='http://192.168.100.109:3000/api'
$env:EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=''
$env:EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=''
$env:EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=''
pnpm.cmd --filter @homeapp/mobile dev
```

Jeśli testujesz na fizycznym telefonie, `localhost` oznacza telefon, nie komputer.
Wtedy ustaw `EXPO_PUBLIC_API_URL` na adres IP komputera w sieci lokalnej, np.
`http://192.168.1.20:3000/api`.

## APK lokalny

Do testu na telefonie bez kabla i bez Metro uzywaj release APK:

```text
builds/homeapp-release.apk
```

Ten APK ma wbudowany JS bundle i adres API zapisany podczas buildu. Dla aktualnej sieci zostal zbudowany z:

```text
http://192.168.100.109:3000/api
```

Telefon nadal musi byc w tej samej sieci Wi-Fi co komputer z backendem.

Debug APK znajduje sie w:

```text
builds/homeapp-debug.apk
```

Debug APK jest buildem developerskim. Najwygodniej testowac go razem z uruchomionym API i Metro:

```powershell
$env:EXPO_PUBLIC_API_URL='http://<ip-komputera>:3000/api'
pnpm.cmd --filter @homeapp/mobile dev -- --host lan
```

Na tym komputerze aktualny adres Wi-Fi podczas buildu wynosil `192.168.100.109`, wiec przy tej samej sieci mozna uzyc `http://192.168.100.109:3000/api`.

## Skrypty startowe

API mozna uruchomic krocej przez:

```powershell
.\scripts\start-api-dev.cmd -DatabaseUrl 'postgres://postgres:<haslo-url-encoded>@localhost:5432/homeapp_dev' -Migrate
```

Metro dla APK/debug mobile:

```powershell
.\scripts\start-mobile-dev.cmd -ApiUrl 'http://192.168.100.109:3000/api' -HostMode lan
```

Wersje `.cmd` omijaja lokalna blokade PowerShell Execution Policy.

## Testowanie na Androidzie przez Wi-Fi

Telefon nie musi byc podlaczony kablem, ale musi byc w tej samej sieci Wi-Fi co komputer.

1. Jednorazowo otworz porty w Windows Firewall. Skrypt poprosi o zgode administratora:

```powershell
.\scripts\open-firewall-dev.cmd
```

2. Uruchom API na komputerze:

```powershell
.\scripts\start-api-dev.cmd -DatabaseUrl 'postgres://postgres:<haslo-url-encoded>@localhost:5432/homeapp_dev' -Migrate
```

3. W drugim terminalu uruchom Metro z adresem LAN komputera:

```powershell
.\scripts\start-mobile-dev.cmd -ApiUrl 'http://192.168.100.109:3000/api' -HostMode lan
```

4. Sprawdz LAN z komputera:

```powershell
.\scripts\check-lan-dev.cmd
```

5. Sprawdz z telefonu w przegladarce:

```text
http://192.168.100.109:3000/api/health
```

Jesli telefon pokazuje `{"status":"ok","service":"homeapp-api"}`, aplikacja mobilna tez powinna widziec backend.

Release APK nie potrzebuje Metro. Debug APK moze potrzebowac Metro na `192.168.100.109:8081`. Jesli aplikacja poprosi o adres serwera developerskiego, ustaw `192.168.100.109:8081`.

## Budowanie APK debug na Windows

Z powodu limitu sciezek Windows i pnpm, APK budujemy z krotkiej kopii `C:\ha`.
Skrypt kopiuje repo bez `node_modules`, robi `pnpm install`, sprawdza mobile i kopiuje APK do `builds`.

```powershell
.\scripts\build-mobile-debug-apk.cmd
```

Wyniki:

```text
builds/homeapp-debug.apk
builds/homeapp-debug-YYYYMMDD-HHMM.apk
```

Na potrzeby lokalnego debug APK React Native New Architecture jest wylaczone w Androidzie (`newArchEnabled=false`), bo na tej maszynie omija to najdluzsze sciezki CMake.

## Budowanie APK release standalone na Windows

Release APK budujemy z krotkiej tymczasowej kopii i hoisted `node_modules`, zeby ominac limit dlugosci sciezek CMake/Ninja na Windows. Skrypt zapisuje adres API w bundle JS.

```powershell
.\scripts\build-mobile-release-apk.cmd -ApiUrl 'http://192.168.100.109:3000/api'
```

Jesli trzeba wskazac konkretny katalog roboczy:

```powershell
.\scripts\build-mobile-release-apk.cmd -ApiUrl 'http://192.168.100.109:3000/api' -WorkDir 'C:\h4'
```

Wyniki:

```text
builds/homeapp-release.apk
builds/homeapp-release-YYYYMMDD-HHMM.apk
```

### Aktualny release do testu na telefonie

Najnowszy build po utwardzeniu auth/sesji/realtime/e-mail:

```text
builds/homeapp-release.apk
builds/homeapp-release-20260430-1838.apk
```

Parametry:
- Android `versionCode`: `2`
- Android `versionName`: `0.1.1`
- API wbudowane w bundle: `http://192.168.100.109:3000/api`
- Metro nie jest potrzebne.

Przed testem odinstaluj poprzednia wersje HomeApp z telefonu i zainstaluj najnowszy APK. Ten build zawiera natywny modul `expo-secure-store`, Google AuthSession/WebBrowser oraz obsluge deep linkow `homeapp://auth` dla resetu i weryfikacji e-mail.

Do finalnego podpisu sklepowego ustaw przed buildem:

```powershell
$env:HOMEAPP_ANDROID_KEYSTORE_PATH='C:\sekrety\homeapp-release.keystore'
$env:HOMEAPP_ANDROID_KEYSTORE_PASSWORD='<password>'
$env:HOMEAPP_ANDROID_KEY_ALIAS='<alias>'
$env:HOMEAPP_ANDROID_KEY_PASSWORD='<password>'
```

Bez tych zmiennych skrypt buduje APK podpisany debugowym kluczem, dobry tylko do testow lokalnych.
