# Production deploy

Automatyczne wdrożenia po aktualizacji `main`:
[konfiguracja, logi i rollback](automatic-deploy.md).

Produkcja web i API działa pod **https://app.porabkihome.pl**.
Frontend używa `/api` pod tą samą domeną. Cloudflare Tunnel kończy HTTPS i kieruje
ruch do `http://127.0.0.1:3003`. Ten port publikuje teraz kontener `web` (Nginx),
który serwuje SPA i przekazuje `/api` bez zmiany ścieżki do `api:3000`.
Lokalny adres origin tunelu pozostaje wewnętrznym szczegółem infrastruktury.
API oraz PostgreSQL nie publikują portów na zewnątrz Dockera.

## Dostęp i stan wyjściowy

- SSH: `homeapp@192.168.100.246`, klucz `C:\Users\moski\.ssh\homeapp_prod_ed25519`.
- Repo: `/opt/homeapp`; sekrety: `/opt/homeapp/.env`.
- Przegląd przed wydaniem web potwierdził działające kontenery API/DB i usługę
  `cloudflared`; repo serwera było na `forgravity`. Wydania web przechodzą na `main`.
- Nie nadpisuj lokalnych plików serwera i nie commituj sekretów.

## Przygotowanie merge do main

1. W PR do `main` uruchom workflow `Web production checks`: lint i testy web,
   typecheck i testy API, build obu obrazów, test Nginx, SPA i proxy `/api`.
2. Lokalnie używaj Node >=22.12 (obrazy web/CI: Node 24) i pnpm 9.15.4:

```powershell
pnpm.cmd install --filter @homeapp/web... --filter @homeapp/api... --frozen-lockfile
pnpm.cmd --filter @homeapp/shared-types build
pnpm.cmd --filter @homeapp/shared-validation build
pnpm.cmd --filter @homeapp/web lint
pnpm.cmd --filter @homeapp/web test
pnpm.cmd --filter @homeapp/web build
pnpm.cmd --filter @homeapp/api typecheck
pnpm.cmd --filter @homeapp/api test
```

## Konfiguracja pierwszego wydania web

W istniejącym `/opt/homeapp/.env` ustaw poniższe wartości, zachowując pozostałe
sekrety i integracje. Nie zastępuj tego pliku przykładowym env.

```dotenv
APP_PUBLIC_URL=https://app.porabkihome.pl
AUTH_LINK_BASE_URL=https://app.porabkihome.pl/auth
VITE_GOOGLE_CLIENT_ID=<publiczny identyfikator klienta Google typu Web>
```

`AUTH_LINK_BASE_URL` trzeba zmienić również wtedy, gdy istniejący env zawiera
`homeapp://auth`: jawna wartość ma pierwszeństwo przed domyślną z Compose.
Linki z wiadomości (także wcześniej wysłanych) otworzą odtąd web: potwierdzenie
adresu, reset hasła i zaproszenie. Ustawienie `homeapp://auth` przywraca otwieranie
aplikacji mobilnej. Nie zmieniaj callbacku integracji Google Calendar.

Dodaj publiczny web client ID do istniejącej listy `GOOGLE_OAUTH_CLIENT_IDS`,
zachowując identyfikatory Android/iOS. W Google Cloud dla klienta Web dodaj
Authorized JavaScript origin `https://app.porabkihome.pl` (bez `/api`).
Puste `VITE_GOOGLE_CLIENT_ID` wyłącza przycisk Google w webie; logowanie hasłem
pozostaje dostępne. Żadne sekrety OAuth nie mogą mieć prefiksu `VITE_`.
Zmienne Vite są osadzane podczas budowania, więc zmiana client ID wymaga rebuild.

### Utworzenie klienta Google dla webu

1. Otwórz Google Cloud Console, wybierz projekt HomeApp i przejdź do
   **Google Auth Platform → Clients**.
2. Wybierz **Create client**, typ **Web application**, a jako nazwę wpisz np.
   `HomeApp Web Production`.
3. W **Authorized JavaScript origins** dodaj dokładnie
   `https://app.porabkihome.pl`. Ta implementacja używa callbacku JavaScript,
   dlatego nie wymaga wpisu w **Authorized redirect URIs**.
4. Skopiuj wartość **Client ID** kończącą się na `.apps.googleusercontent.com`.
   Do logowania w przeglądarce nie kopiuj i nie publikuj **Client secret**.
5. W `/opt/homeapp/.env` ustaw client ID dla budowanego webu oraz dopisz go po
   przecinku do listy akceptowanej przez API, pozostawiając klienta mobilnego:

   ```dotenv
   VITE_GOOGLE_CLIENT_ID=<WEB_CLIENT_ID>.apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_IDS=<ANDROID_CLIENT_ID>.apps.googleusercontent.com,<WEB_CLIENT_ID>.apps.googleusercontent.com
   ```

6. W **Google Auth Platform → Audience** dodaj konta testowe albo opublikuj
   aplikację dla użytkowników produkcyjnych. Do zwykłego logowania wystarczają
   zakresy `openid`, `email` i `profile`.
7. Przebuduj kontenery `api` i `web`, ponieważ `VITE_GOOGLE_CLIENT_ID` trafia do
   statycznych plików podczas budowania obrazu.

Sprawdź w konfiguracji Cloudflare Tunnel, że **cały host** `app.porabkihome.pl`
kieruje do `http://127.0.0.1:3003`, bez ograniczenia do `/api/*`.
Zachowaj HTTPS i nie ustawiaj cache dla HTML, `/auth/*` ani `/api/*`.

## Wydanie po scaleniu PR

Wykonuj na serwerze po zatwierdzeniu wdrożenia. Przed pierwszym wydaniem zachowaj
backup bazy, `.env` i identyfikatory poprzednich obrazów poza repozytorium.

```bash
cd /opt/homeapp
git status --short --branch
git rev-parse HEAD  # zapisz jako PREVIOUS_COMMIT do rollbacku
docker compose -f compose.prod.yml --env-file .env images
git fetch origin
git switch main
git pull --ff-only origin main
docker compose -f compose.prod.yml --env-file .env config --quiet
# Buduj przed zatrzymaniem starego API; błąd builda nie przerywa działania.
docker compose -f compose.prod.yml --env-file .env build
# Przy pierwszym wdrożeniu API zwalnia port 3003, który przejmuje web.
docker compose -f compose.prod.yml --env-file .env up -d api
docker compose -f compose.prod.yml --env-file .env up -d web
docker compose -f compose.prod.yml --env-file .env ps
curl -fsS http://127.0.0.1:3003/healthz
curl -fsS http://127.0.0.1:3003/api/health
curl -fsS https://app.porabkihome.pl/api/health
curl -fsS https://app.porabkihome.pl/finanse
```

Jeśli lokalna gałąź `main` na serwerze nie istnieje, `git switch main` utworzy ją
ze śledzeniem `origin/main`. Konflikt lub rozbieżna historia wymaga wyjaśnienia;
nie używaj `reset --hard`. Migracje API uruchamiają się przy starcie kontenera.
Pierwsze przełączenie portu może spowodować krótką przerwę w dostępności.

W przeglądarce sprawdź HTTPS, odświeżenie `/finanse`, logowanie hasłem i Google,
wylogowanie, zaproszenie, reset hasła, weryfikację e-mail, upload/download plików
oraz odblokowanie i zapis finansów w domu z E2EE i bez E2EE. Zweryfikuj też
logowanie i API dotychczasowej aplikacji mobilnej.

## Rollback

Zachowaj poprzednie obrazy do zakończenia testów odbiorowych. Jeśli wracasz do
wydania sprzed weba, najpierw zatrzymaj web, aby zwolnić port 3003:

```bash
cd /opt/homeapp
docker compose -f compose.prod.yml --env-file .env stop web
git switch --detach PREVIOUS_COMMIT
# Przywróć poprzedni .env z backupu.
docker compose -f compose.prod.yml --env-file .env up -d --no-build --remove-orphans
curl -fsS http://127.0.0.1:3003/api/health
```

Przed `up --no-build` przywróć tag obrazu API z zapisanego identyfikatora poprzedniego
obrazu (`docker tag <poprzednie-id-api> homeapp-api`). Rollback kodu nie cofa migracji;
jeśli wydanie zmienia schemat, oceniaj zgodność i odtworzenie backupu oddzielnie.

Dokumentacja mechanizmów: [Vite env](https://vite.dev/guide/env-and-mode),
[Nginx proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

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
