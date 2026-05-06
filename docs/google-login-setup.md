# Google login setup

Ten projekt ma juz podpiety kod pod Google OAuth. Przycisk Google zacznie dzialac po dodaniu Android OAuth Client ID do EAS i API.

## Dane projektu

- Android package: `com.homeapp.mobile`
- API public URL: `https://app.porabkihome.pl/api`
- Expo/EAS project: `@moskit17/homeapp`
- Backend env na VM: `/opt/homeapp/.env`

## 1. Utworz OAuth Client w Google Cloud

1. Wejdz w Google Cloud Console.
2. Otworz `APIs & Services` -> `OAuth consent screen` i skonfiguruj ekran zgody.
3. Otworz `APIs & Services` -> `Credentials`.
4. Utworz `OAuth client ID`.
5. Typ aplikacji: `Android`.
6. Package name: `com.homeapp.mobile`.
7. SHA-1: fingerprint certyfikatu, ktory podpisuje APK z EAS.

SHA-1 najlatwiej pobrac z EAS credentials:

```powershell
cd c:\Users\moski\Desktop\homeapp\apps\mobile
npx eas-cli credentials -p android
```

W menu Android credentials wejdz w keystore/certificate details. Jesli pobierzesz keystore lokalnie, SHA-1 sprawdzisz przez:

```bash
keytool -list -v -keystore path/to/keystore.jks -alias <alias>
```

## 2. Ustaw env w EAS

Wartoscia jest Android OAuth Client ID z Google Cloud, zwykle konczy sie na `.apps.googleusercontent.com`.

```powershell
cd c:\Users\moski\Desktop\homeapp\apps\mobile
npx eas-cli env:create preview --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value "<ANDROID_CLIENT_ID>" --visibility plaintext --force
npx eas-cli env:create production --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value "<ANDROID_CLIENT_ID>" --visibility plaintext --force
```

Potem zbuduj APK ponownie:

```powershell
npx eas-cli build -p android --profile preview
```

## 3. Ustaw env na backendzie

Na VM wpisz ten sam Android Client ID do backendu:

```bash
cd /opt/homeapp
cp .env .env.backup.$(date +%Y%m%d%H%M%S)
sed -i 's#^GOOGLE_OAUTH_CLIENT_ID=.*#GOOGLE_OAUTH_CLIENT_ID=<ANDROID_CLIENT_ID>#' .env
docker compose -f compose.prod.yml --env-file .env up -d --force-recreate api
curl -fsS http://127.0.0.1:3003/api/health
```

Jesli w `.env` nie ma jeszcze tej zmiennej, dodaj ja:

```bash
echo 'GOOGLE_OAUTH_CLIENT_ID=<ANDROID_CLIENT_ID>' >> /opt/homeapp/.env
```

## 4. Test

1. Zainstaluj nowy APK z profilem `preview`.
2. Kliknij `Google` na ekranie logowania.
3. Po udanym logowaniu backend utworzy albo polaczy konto po adresie e-mail.

## Uwaga o produkcji

Dla Google Play moze byc potrzebny drugi OAuth Client ID z SHA-1 certyfikatu `App signing key certificate` z Play Console. Na razie dla APK instalowanego z EAS preview uzywamy SHA-1 keystore z EAS.

Oficjalne odniesienia:

- Expo AuthSession: https://docs.expo.dev/guides/authentication/
- Expo Google auth: https://docs.expo.dev/guides/google-authentication/
- Google OAuth Android client: https://support.google.com/cloud/answer/6158849
