# Production deploy

Ta instrukcja opisuje standardowy deploy API HomeApp na lokalna produkcje.
Nie commituj tu surowych hasel, tokenow Proxmox ani pliku `.env`; do deployu wystarcza lokalny klucz SSH i env na serwerze.

## Hosty i dostep

- Proxmox UI: `https://192.168.100.244:8006`
- Produkcyjny kontener/VM z aplikacja: `192.168.100.246`
- SSH user: `homeapp`
- SSH auth: klucz lokalny `C:\Users\moski\.ssh\homeapp_prod_ed25519`
- Katalog aplikacji na serwerze: `/opt/homeapp`
- Env produkcyjny na serwerze: `/opt/homeapp/.env`
- Docker Compose: `/opt/homeapp/compose.prod.yml`

Proxmox jest potrzebny tylko awaryjnie, gdy trzeba sprawdzic konfiguracje kontenera albo odzyskac dostep SSH.
Zwykly deploy idzie bezposrednio po SSH na `homeapp@192.168.100.246`.

Stan zweryfikowany 2026-06-01: `/opt/homeapp` na produkcji jest repozytorium git na galezi `forgravity`.
Standardowy deploy idzie przez `git fetch` + `git pull --ff-only`; nie przerzucaj recznie plikow przez `scp`,
chyba ze produkcyjne repo zostanie awaryjnie uszkodzone.

## Szybki deploy z Windows

Z katalogu repo na komputerze:

```powershell
pnpm.cmd typecheck
pnpm.cmd test
git status --short --branch
git add .
git commit -m "Opis zmian"
git push origin forgravity
```

Nastepnie na produkcji:

```powershell
ssh -i "$env:USERPROFILE\.ssh\homeapp_prod_ed25519" homeapp@192.168.100.246
```

Na serwerze:

```bash
cd /opt/homeapp
git fetch origin
git checkout forgravity
git pull --ff-only origin forgravity
docker compose -f compose.prod.yml --env-file .env up -d --build
docker compose -f compose.prod.yml --env-file .env ps
curl -fsS http://127.0.0.1:3003/api/health
```

Kontener API odpala migracje DB przy starcie:

```text
pnpm --filter @homeapp/api db:migrate && node apps/api/dist/main.js
```

Dlatego przy deployu zmian backendu i SQL wystarczy przebudowac/restartowac Compose.

## APK build - zasady bez mielenia czasu

Twarda zasada: APK instalowany na telefonie ma byc release buildem z dzialajacym Google OAuth.
Nie wolno budowac ani instalowac release APK bez `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
albo parametru `-GoogleAndroidClientId`. Nie ma obejscia typu "missing Google" dla release APK.

Nie buduj APK przy kazdej poprawce. Jesli zmiana dotyczy tylko API, DB, konfiguracji albo logiki backendu, rob tylko commit,
push i deploy backendu. APK buduj dopiero wtedy, gdy uzytkownik wyraznie prosi o nowy plik APK albo instalacje na telefonie.

Najczestsze bledy na Windows:

- nie buduj z `C:\Users\moski\Desktop\homeapp`, bo Reanimated/CMake wpada w za dlugie sciezki;
- nie uzywaj starego `C:\ha` z poprzednimi cache'ami, bo `android/build/generated/autolinking` potrafi trzymac absolutne sciezki do starego repo;
- nie kopiuj `node_modules`, `android/.gradle`, `android/build`, `android/app/build`, `dist`, `.turbo` ani starych APK;
- po jednym nieudanym buildzie nie odpalaj kolejnego w ciemno; najpierw sprawdz, czy log nie wskazuje starej sciezki albo cache.

Bezpieczny schemat, tylko gdy APK jest naprawde potrzebny:

```powershell
$src = (Get-Location).Path
$work = "C:\ha-build-$(Get-Date -Format yyyyMMddHHmm)"
$env:EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = "<ANDROID_OAUTH_CLIENT_ID>"
$env:EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = "<ANDROID_OAUTH_CLIENT_ID>"
New-Item -ItemType Directory -Path $work | Out-Null

robocopy $src $work /MIR `
  /XD .git node_modules .turbo `
      apps\api\node_modules `
      apps\mobile\node_modules `
      apps\mobile\android\.gradle `
      apps\mobile\android\build `
      apps\mobile\android\app\build `
      apps\mobile\builds `
      apps\mobile\dist `
  /XF apps\mobile\android\local.properties
if ($LASTEXITCODE -gt 7) { throw "robocopy failed: $LASTEXITCODE" }

Set-Location $work
pnpm.cmd install --frozen-lockfile
pnpm.cmd --filter @homeapp/mobile typecheck

Set-Location "$work\apps\mobile\android"
$env:EXPO_PUBLIC_API_URL = "https://app.porabkihome.pl/api"
$env:NODE_ENV = "production"
.\gradlew.bat --stop
.\gradlew.bat assembleRelease
```

Po buildzie sprawdz, czy APK powstal i dopiero wtedy kopiuj go do repo oraz instaluj przez ADB:

```powershell
$apk = "$work\apps\mobile\android\app\build\outputs\apk\release\app-release.apk"
Test-Path $apk
Copy-Item $apk "$src\apps\mobile\builds\homeapp-0.1.xx-release.apk"
adb devices -l
adb install -r "$src\apps\mobile\builds\homeapp-0.1.xx-release.apk"
```

Jesli build pokazuje `C:\Users\moski\Desktop\homeapp\apps\mobile\node_modules\react-native-reanimated` w logu CMake,
to znaczy, ze nadal bierze stary cache/autolinking. Przerwac, usunac katalog roboczy i zaczac od nowego `$work`.

## Kontrola po deployu

Na serwerze:

```bash
docker compose -f compose.prod.yml --env-file .env logs --tail=100 api
curl -fsS http://127.0.0.1:3003/api/health
```

Z komputera lokalnego, jesli tunel/domena jest aktywna:

```powershell
Invoke-RestMethod https://app.porabkihome.pl/api/health
```

Oczekiwany wynik healthchecka:

```json
{ "status": "ok", "service": "homeapp-api" }
```

## Kontrola AI zakupów

AI listy zakupów działa tylko wtedy, gdy `/opt/homeapp/.env` zawiera poprawny `GEMINI_API_KEY`.
Jeśli endpoint zwraca komunikat o konfiguracji albo Gemini, sprawdź logi:

```bash
cd /opt/homeapp
docker compose -f compose.prod.yml --env-file .env logs --tail=100 api | grep Gemini
```

Komunikat `API_KEY_INVALID` oznacza, że klucz Gemini w produkcyjnym `.env` trzeba wymienić i zrestartować API:

```bash
cd /opt/homeapp
docker compose -f compose.prod.yml --env-file .env up -d --build
```

## Awaryjnie bez `.git`

Ta sciezka jest nieaktualna dla normalnych deployow. Uzyj recznego `scp` tylko wtedy, gdy `/opt/homeapp/.git`
zniknie albo repo na produkcji bedzie uszkodzone i nie da sie wykonac `git pull --ff-only`.

## Gdzie trzymac sekrety

- `/opt/homeapp/.env` na produkcji zawiera sekrety API, DB, SMTP, OAuth i Gemini.
- `GEMINI_API_KEY` ustawiaj tylko w backendowym `.env`; aplikacja mobilna nie powinna znac klucza Gemini.
- Po pokazaniu klucza na screenie wygeneruj nowy klucz w Google AI Studio i usun stary.
- `C:\Users\moski\.ssh\homeapp_prod_ed25519` daje dostep SSH do produkcji.
- Lokalne notatki z tokenami lub haslami trzymaj w plikach pasujacych do `deploy/*.local.*`, bo sa ignorowane przez git.
- Nie dodawaj do commita tokenow Proxmox, hasel ani prywatnych kluczy.
