# Expo / EAS setup

Ten projekt nie mial jeszcze przypietego projektu EAS w repo. Lokalny release APK mozna nadal budowac skryptem Gradle,
ale push notifications i powtarzalne buildy EAS wymagaja konta Expo, `projectId` i Firebase Cloud Messaging dla Androida.

## 1. Sprawdz konto w tym samym terminalu

Uruchom z katalogu `apps/mobile`:

```powershell
npx expo login
npx eas-cli login
npx eas-cli whoami
```

Jesli wyswietla zle konto:

```powershell
npx eas-cli logout
npx eas-cli login
npx eas-cli whoami
```

## 2. Przypnij albo utworz projekt EAS

Po zalogowaniu:

```powershell
npx eas-cli init
npx eas-cli project:info
```

`eas init` powinien dopisac `extra.eas.projectId` do konfiguracji Expo. Ten identyfikator jest potrzebny do
`Notifications.getExpoPushTokenAsync`.

Jesli masz juz istniejacy projekt EAS, podepnij go jawnie:

```powershell
npx eas-cli init --id <project-id> --force
```

## 3. Ustaw API dla buildow

W `apps/mobile/eas.json` podmien:

```json
"EXPO_PUBLIC_API_URL": "https://api.twoja-domena.pl/api"
```

na docelowy adres API za Cloudflare Tunnel.

Do lokalnego Gradle builda mozna uzyc `apps/mobile/.env` na podstawie `apps/mobile/.env.example`.

## 4. Skonfiguruj darmowe push notifications na Androidzie

Expo Push Service jest darmowy dla naszego zastosowania, ale Android dalej wymaga Firebase Cloud Messaging.
Potrzebne sa dwa elementy: publiczny `google-services.json` w aplikacji oraz prywatny klucz FCM V1 w EAS.

1. Wejdz w Firebase Console i utworz albo wybierz projekt dla HomeApp.
2. W `Project settings` -> `General` dodaj aplikacje Android:
   - Android package name: `com.homeapp.mobile`
   - App nickname: `HomeApp`
3. Pobierz `google-services.json` i zapisz go lokalnie jako:

```text
apps/mobile/google-services.json
```

Ten plik jest ignorowany w `apps/mobile/.gitignore`.

4. W Firebase Console wejdz w `Project settings` -> `Service accounts`.
5. Kliknij `Generate new private key` i pobierz JSON z kluczem serwisowym. Tego pliku nie commituj.
6. Wgraj klucz FCM V1 do EAS:

```powershell
cd apps/mobile
npx eas-cli credentials
```

W menu wybierz:

```text
Android -> production -> Google Service Account
Manage your Google Service Account Key for Push Notifications (FCM V1)
Set up a Google Service Account Key for Push Notifications (FCM V1)
Upload a new service account key
```

Po tej konfiguracji trzeba zbudowac i zainstalowac nowy APK, bo natywna konfiguracja FCM trafia do builda.

## 5. Buildy

APK do testow wewnetrznych:

```powershell
npx eas-cli build -p android --profile preview
```

AAB do Google Play:

```powershell
npx eas-cli build -p android --profile production
```

Lokalny APK bez EAS nadal:

```powershell
.\scripts\build-mobile-release-apk.cmd -ApiUrl "https://api.twoja-domena.pl/api"
```
