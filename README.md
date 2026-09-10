# HomeApp

HomeApp to rodzinny organizer domu z aplikacją mobilną na Androida/iOS i własnym API. Łączy finanse, zakupy, plan posiłków, kalendarz, zadania, notatki, obowiązki, koszty roczne, pliki i zarządzanie domownikami.

## Najważniejsze cechy

- budżet miesięczny per domownik, kategorie, wydatki, oszczędności oraz długi,
- opcjonalne szyfrowanie end-to-end danych wybranych modułów,
- import wydatków z powiadomień aplikacji bankowych na Androidzie,
- wspólne listy zakupów, kalendarz, zadania, notatki i plan posiłków,
- role i uprawnienia per domownik,
- powiadomienia push oraz realtime ograniczone do aktywnego domu,
- własne logowanie JWT, Google OAuth i przepływy e-mail.

Import bankowy nie łączy się z bankiem. Android przekazuje powiadomienie do lokalnego parsera, a użytkownik zawsze sprawdza i zatwierdza wynik. Surowa treść powiadomienia nie jest wysyłana do API.

## Stos technologiczny

| Obszar        | Technologia                                            |
| ------------- | ------------------------------------------------------ |
| Monorepo      | pnpm 9, Turborepo, TypeScript                          |
| Mobile        | Expo 52, React Native 0.76, Expo Router                |
| Moduł Android | Kotlin, NotificationListenerService, Room, WorkManager |
| API           | NestJS 10                                              |
| Baza          | PostgreSQL, migracje SQL-first                         |
| Walidacja     | class-validator, Zod                                   |
| Testy         | Vitest, Jest, JUnit, AndroidX Test                     |

## Struktura repozytorium

```text
apps/
  api/       API NestJS
  web/       aplikacja przeglądarkowa React/Vite
  mobile/    aplikacja Expo/React Native i lokalne moduły Expo
db/
  migrations/
packages/
  shared-types/
  shared-validation/
docs/
scripts/
```

## Wymagania

- Node.js co najmniej 20.11,
- dla klienta web: Node.js >=22.12 (produkcja web i CI używają Node 24),
- pnpm 9.15.4,
- PostgreSQL,
- dla Androida: Android Studio/JDK i skonfigurowany Android SDK.

Na Windows używaj `pnpm.cmd`, jeżeli polityka PowerShell blokuje `pnpm.ps1`.

## Pierwsze uruchomienie

```powershell
pnpm.cmd install
Copy-Item apps\api\.env.example apps\api\.env
pnpm.cmd --filter @homeapp/api db:migrate
pnpm.cmd dev
```

Ustaw co najmniej `DATABASE_URL`, `JWT_ACCESS_SECRET` i `JWT_REFRESH_SECRET` zgodnie z `apps/api/.env.example`. Aplikacja mobilna pobiera adres API z `EXPO_PUBLIC_API_URL`.

Pełna instrukcja lokalna, w tym PostgreSQL, SMTP, Google OAuth, LAN i Android, znajduje się w [docs/local-development.md](docs/local-development.md).

## Kontrole jakości

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd build
```

Test parsera importu Android bez instalowania aplikacji:

```powershell
Set-Location apps\mobile\android
.\gradlew.bat :homeapp-notification-expense-import:testDebugUnitTest
```

Kompilacja testów instrumentalnych, również bez instalowania APK:

```powershell
.\gradlew.bat :homeapp-notification-expense-import:compileDebugAndroidTestKotlin
```

## Migracje

Migracje są wykonywane kolejno z `db/migrations`:

```powershell
pnpm.cmd --filter @homeapp/api db:migrate
```

Migracja importu wydatków jest addytywna. Rozszerza rekord wydatku o nazwę, źródło, czas operacji i opcjonalną walutę źródłową oraz dodaje trwały rejestr idempotencji.

## Import wydatków z powiadomień

Funkcja jest dostępna wyłącznie na Androidzie i domyślnie wyłączona. Jej główne zasady:

- użytkownik jawnie nadaje systemowy dostęp do powiadomień,
- aplikacje źródłowe są wykrywane tylko na podstawie faktycznie otrzymanych powiadomień,
- treść analizowana jest wyłącznie dla źródeł włączonych przez użytkownika,
- parser działa lokalnie i nie korzysta z AI ani usług zewnętrznych,
- kolejka Room jest szyfrowana AES-256-GCM kluczem z Android Keystore,
- indeksy deduplikacyjne używają osobnego klucza HMAC,
- zapis do budżetu wymaga ponownego sprawdzenia uprawnienia `finances/create`,
- dla szyfrowanych finansów nazwa, kwota i metadane trafiają do istniejącej koperty E2EE,
- API przyjmuje paczkę i zwraca wynik osobno dla każdej pozycji.

Szczegóły architektury, retencji, prywatności, błędów i publikacji: [docs/android-notification-expense-import.md](docs/android-notification-expense-import.md).

## Bezpieczeństwo i prywatność

- Tokeny odświeżające są przechowywane w bazie jako hashe.
- Dane modułów E2EE są szyfrowane na kliencie i wersjonowane.
- Lokalna kolejka importu ma oddzielny klucz urządzenia i nie jest objęta backupem Androida.
- Backend nie otrzymuje pakietu aplikacji bankowej, tekstu powiadomienia ani lokalnego fingerprintu.
- Izolacja danych opiera się na aktywnym `householdId` i uprawnieniach modułowych.
- Sekretów, kluczy odzyskiwania, keystore i danych testowych nie wolno commitować.

Więcej: [docs/encryption.md](docs/encryption.md), [docs/finances.md](docs/finances.md) i [docs/mobile-permissions.md](docs/mobile-permissions.md).

## Publikacja Android

Przed publikacją trzeba co najmniej:

1. sprawdzić treść prominent disclosure przed przejściem do systemowego ekranu dostępu,
2. uzupełnić politykę prywatności i sekcję Data safety w Play Console,
3. zweryfikować `POST_NOTIFICATIONS` dla przypomnień na Androidzie 13+,
4. sprawdzić reguły backupu, migracje Room i migrację PostgreSQL,
5. wykonać test na wspieranych wersjach Androida oraz test aktualizacji z poprzedniej wersji,
6. zbudować artefakt właściwym kluczem sklepowym i prawidłową konfiguracją Google OAuth.

Nie traktuj lokalnego debug/release APK jako artefaktu sklepowego.

## Dokumentacja

- [Lokalny development](docs/local-development.md)
- [Import wydatków z powiadomień Android](docs/android-notification-expense-import.md)
- [Finanse](docs/finances.md)
- [Szyfrowanie](docs/encryption.md)
- [Uprawnienia mobile](docs/mobile-permissions.md)
- [Powiadomienia i akcje](docs/powiadomienia-akcje.md)
- [Konfiguracja Google](docs/google-login-setup.md)
- [Konfiguracja Expo/EAS](docs/expo-eas-setup.md)
- [Deploy produkcyjny](docs/production-deploy.md)
- [Dziennik zmian](docs/progress.md)

## Zasady pracy

- Nowe zmiany wykonuj na osobnej gałęzi.
- Nie commituj cudzych lub niezwiązanych zmian z brudnego worktree.
- Nie uruchamiaj migracji produkcyjnych, deployu, publikacji ani instalacji APK bez jawnej zgody właściciela środowiska.
- Każdą zmianę w finansach sprawdzaj dla domu z włączonym i wyłączonym E2EE.
