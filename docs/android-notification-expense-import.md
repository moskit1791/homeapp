# Import wydatków z powiadomień na Androidzie

## Cel i granice funkcji

HomeApp może lokalnie rozpoznać informację o płatności z powiadomienia wybranej aplikacji i przygotować szkic wydatku. Funkcja:

- działa tylko na Androidzie,
- jest domyślnie wyłączona,
- nie loguje się do banku i nie używa API bankowego,
- nie używa AI ani zewnętrznej usługi do interpretacji tekstu,
- nie zapisuje wydatku automatycznie,
- nie wysyła surowej treści powiadomienia do backendu,
- wymaga jawnego zatwierdzenia przez użytkownika.

Na iOS ekran pokazuje wyłącznie informację, że system nie udostępnia aplikacjom równoważnego odczytu powiadomień innych aplikacji.

## Ograniczenia systemowe

- HomeApp widzi tylko nowe powiadomienia dostarczone po nadaniu dostępu; nie importuje historii banku.
- Aplikacja bankowa lub ustawienia ekranu blokady mogą ukryć kwotę, walutę albo sprzedawcę.
- Producent telefonu może ograniczać procesy w tle; użytkownik może być zmuszony wyłączyć agresywną optymalizację baterii dla HomeApp.
- Android może ograniczać listenery na starszych urządzeniach low-RAM, w profilu służbowym albo przez politykę administratora.
- Zmiana formatu powiadomień aplikacji bankowej może obniżyć skuteczność parsera do czasu aktualizacji reguł.
- Parser nie potwierdza rozliczenia operacji w banku i nie zastępuje historii rachunku.

## Przepływ użytkownika

1. Użytkownik otwiera `Dom -> Import wydatków`.
2. Aplikacja pokazuje wyjaśnienie celu, zakresu danych i lokalnego przetwarzania.
3. Użytkownik może przejść do systemowego ekranu Androida i włączyć usługę HomeApp.
4. Lista źródeł uzupełnia się dopiero po faktycznie odebranych powiadomieniach.
5. Użytkownik osobno włącza aplikacje, których treść wolno analizować.
6. Rozpoznane operacje trafiają do lokalnej, zaszyfrowanej kolejki.
7. Ekran `Oczekujące płatności` pozwala zmienić nazwę, kwotę, walutę i pozycję budżetu.
8. Przy walucie innej niż waluta domu użytkownik ręcznie podaje finalną kwotę budżetową. HomeApp nie przelicza kursu.
9. Po zatwierdzeniu aplikacja ponownie sprawdza `finances/create` i wysyła wyłącznie finalne dane wydatku.
10. API zwraca status każdej pozycji: `created`, `duplicate` albo `failed`.

## Warstwy implementacji

### Listener Android

Lokalny moduł Expo znajduje się w:

```text
apps/mobile/modules/homeapp-notification-expense-import
```

`NotificationExpenseListenerService` rozszerza `NotificationListenerService`. Usługa jest zadeklarowana z:

```xml
android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
```

oraz akcją:

```text
android.service.notification.NotificationListenerService
```

HomeApp nie używa `QUERY_ALL_PACKAGES`. Nazwa pakietu i etykieta aplikacji trafiają na listę źródeł dopiero po rzeczywistym zdarzeniu `onNotificationPosted`.

### Wybór źródła

Dla nowo wykrytej aplikacji zapisywane są tylko zaszyfrowane:

- nazwa pakietu,
- etykieta aplikacji,
- czas pierwszego i ostatniego wykrycia,
- flaga włączenia.

Tekst niewybranego źródła nie jest parsowany ani zapisywany. Włączenie źródła jest świadomą decyzją użytkownika.

### Parser lokalny

`UniversalNotificationTransactionParser` jest deterministyczny i wersjonowany identyfikatorem `universal-v1`. Rozpoznaje typowe komunikaty w języku polskim, angielskim, niemieckim, hiszpańskim i francuskim.

Obsługiwane są między innymi:

- płatność kartą,
- obciążenie karty,
- zakup,
- przelew wychodzący,
- wypłata z bankomatu,
- zwrot oznaczany jako wymagający sprawdzenia.

Odrzucane są między innymi:

- operacje odrzucone i anulowane,
- OTP, PIN, hasła i kody logowania,
- saldo,
- przelew przychodzący,
- oferty kredytowe i marketing,
- samo przypomnienie o terminie płatności.

Kwota jest normalizowana dla separatorów `,`, `.`, spacji i NBSP. Symbole `$` i `kr` są niejednoznaczne, więc parser nie zgaduje waluty i wymusza kontrolę. Brak nazwy sprzedawcy lub waluty również podnosi `requiresReview`.

Testy parsera:

```powershell
Set-Location apps\mobile\android
.\gradlew.bat :homeapp-notification-expense-import:testDebugUnitTest
```

## Lokalny model danych

Room przechowuje trzy tabele:

| Tabela                              | Zawartość                                      |
| ----------------------------------- | ---------------------------------------------- |
| `notification_sources`              | wykryte źródła i decyzja użytkownika           |
| `pending_notification_transactions` | szkice oraz tombstone po imporcie/odrzuceniu   |
| `notification_import_state`         | ustawienia funkcji, lokalny kontekst i licznik |

Źródła i deduplikacja są rozdzielone dla pary profil/dom. Migracja Room `1 -> 2 -> 3 -> 4` zachowuje dotychczasowe ustawienia, a stare, nieskopowane źródła przypisuje leniwie dopiero po odtworzeniu zaszyfrowanego kontekstu bieżącego profilu i domu.

Wiersze kolejki mają niejawne indeksy:

- HMAC klucza powiadomienia,
- HMAC lokalnego fingerprintu,
- HMAC profilu,
- HMAC domu.

Losowy `sourceExternalId` jest identyfikatorem idempotencji przekazywanym do API. Lokalny fingerprint nie opuszcza urządzenia.

Kolejka działa bez uruchomionego JavaScriptu. Interfejs React Native odczytuje ją dopiero po otwarciu ekranu.

## Szyfrowanie kolejki

### Klucze

Android Keystore przechowuje dwa nieeksportowalne klucze:

- AES-256 do szyfrowania treści kolejki,
- HMAC-SHA-256 do indeksów i deduplikacji.

Klucze kolejki są niezależne od klucza E2EE domu. Nie są pokazywane użytkownikowi i nie są synchronizowane.

### Koperta

Każdy zapis używa AES/GCM/NoPadding:

- nowy, losowy nonce 12 bajtów,
- tag uwierzytelniający 128 bitów,
- AAD `homeapp:notification-import:v1:<id>:<schemaVersion>`.

Zmiana ciphertextu, nonce, identyfikatora albo wersji schematu powoduje błąd uwierzytelnienia.

### Stan utraty klucza

Zaszyfrowany stan zawiera kontrolną wartość wyprowadzoną z klucza indeksów. Jeżeli baza istnieje, a klucz AES/HMAC zniknął lub został unieważniony, moduł zwraca `unavailable`.

UI nie próbuje odzyskać nieodszyfrowywalnych danych. Użytkownik może usunąć wyłącznie lokalną kolejkę i wygenerować nowy zestaw kluczy. Wydatki wcześniej zatwierdzone w budżecie pozostają bez zmian.

## Powiązanie z profilem, domem i uprawnieniami

Po zalogowaniu warstwa React Native przekazuje modułowi:

- `sub` z access tokenu jako identyfikator profilu,
- aktywny `householdId`,
- bieżące `finances/create`,
- czas wygaśnięcia autoryzacji.

Przechwytywanie działa tylko wtedy, gdy:

- funkcja jest włączona,
- źródło jest włączone,
- profil i dom są znane,
- użytkownik ma `finances/create`,
- lokalnie zapisana autoryzacja nie wygasła.

Wylogowanie czyści kontekst i wyłącza przechwytywanie, ale nie usuwa kolejki. Pozycje są widoczne tylko dla tego samego lokalnego profilu i domu. Po ponownym logowaniu użytkownik świadomie włącza funkcję ponownie; zmiana profilu lub domu nie może automatycznie wznowić odczytu.

Przed zatwierdzeniem aplikacja odświeża uprawnienia z API. Endpoint jest dodatkowo chroniony przez `JwtAuthGuard`, `HouseholdContextGuard`, `PermissionGuard` i `@RequirePermission('finances', 'create')`.

## E2EE finansów

Lokalny klucz kolejki i klucz finansów rozwiązują dwa różne problemy:

- klucz kolejki zabezpiecza dane oczekujące na konkretnym urządzeniu,
- klucz domu zabezpiecza zatwierdzone dane synchronizowane przez backend.

Jeżeli moduł `finances` ma włączone E2EE, klient umieszcza w istniejącej kopercie encji `expense`:

```json
{
  "amount": 24.5,
  "name": "Zakupy",
  "occurredAt": "2026-07-26T08:00:00.000Z",
  "originalAmount": 5.5,
  "originalCurrency": "EUR",
  "source": "bank_notification"
}
```

AAD pozostaje `homeapp:finances:expense`. Dzięki temu:

- stare koperty zawierające tylko `amount` nadal się otwierają,
- stary klient odczyta pole `amount` z rozszerzonego JSON,
- nowy klient stosuje wartości domyślne dla brakujących pól,
- rotacja klucza używa istniejącego mechanizmu finansów.

Backend odrzuca jawną nazwę i metadane waluty źródłowej, gdy finanse domu są szyfrowane.

## API i idempotencja

Endpoint:

```text
POST /api/finance/expenses/import
```

Przyjmuje od 1 do 100 pozycji. Każda zawiera:

- lokalny `clientId`,
- `budgetItemId`,
- finalną kwotę w walucie budżetu,
- opcjonalny jawny `occurredAt` dla domu bez E2EE; przy E2EE czas jest wyłącznie w kopercie,
- losowy `sourceExternalId`,
- nazwę i opcjonalną walutę źródłową albo kopertę E2EE.

API zapisuje `source = bank_notification`. API zwraca wynik per element dla oczekiwanych błędów domenowych, takich jak nieaktualna pozycja budżetu. Cała paczka jest jedną transakcją: nieoczekiwany błąd bazy przerywa i wycofuje wszystkie jej zapisy.

Tabela `expense_notification_imports` ma unikalność:

```text
(household_id, source_external_id)
```

Rejestr pozostaje po usunięciu wydatku (`expense_id` przechodzi na `null`), więc ponowienie nie utworzy duplikatu także po późniejszym skasowaniu rekordu. Unikalność jest liczona w obrębie domu.

## Retencja i czyszczenie

- opcjonalny, zaszyfrowany tekst diagnostyczny: 7 dni,
- pozycja oczekująca: 30 dni,
- tombstone `imported`/`ignored`: 180 dni,
- serwerowy ledger idempotencji: bez automatycznego wygaśnięcia,
- ręczne `Usuń lokalne dane oczekujące`: usuwa lokalną kolejkę,
- reset uszkodzonego storage: usuwa lokalną bazę i klucze kolejki.

Backup Androida wyklucza bazę Room, pliki WAL/SHM i preferencje `SecureStore` zarówno dla starego full backup, jak i nowych reguł data extraction.

Niezależne okresowe zadanie WorkManager uruchamia czyszczenie co 24 godziny we wszystkich lokalnych kontekstach. Dzięki temu retencja nie zależy od włączenia ani godziny przypomnienia.

## Przypomnienie

WorkManager planuje jedno zadanie na najbliższą wybraną godzinę, domyślnie 21:00 czasu lokalnego. Po wykonaniu planuje kolejny dzień. Zmiana czasu, strefy, restart telefonu, aktualizacja pakietu lub odblokowanie użytkownika powodują ponowne wyliczenie terminu.

Powiadomienie HomeApp:

- pokazuje wyłącznie liczbę oczekujących pozycji,
- korzysta z zapytania licznikowego i nie odszyfrowuje treści kolejki,
- ma `VISIBILITY_PRIVATE`,
- nie zawiera nazwy banku, sprzedawcy, kwoty ani waluty,
- prowadzi do `homeapp://notification-expense-import`.

Na Androidzie 13+ wyświetlenie przypomnienia wymaga `POST_NOTIFICATIONS`.

## Logowanie i obserwowalność

Logi modułu są celowo neutralne. Nie wolno dodawać do logcat:

- tytułu lub treści powiadomienia,
- nazwy sprzedawcy,
- kwoty lub waluty,
- nazwy pakietu aplikacji bankowej,
- identyfikatora powiadomienia,
- fingerprintu,
- odszyfrowanego JSON.

Backend nie otrzymuje telemetrii parsera ani informacji o zainstalowanych aplikacjach.

## Testy

Automatyczne pokrycie obejmuje:

- formaty kwot i walut PL/EN/DE/ES/FR,
- zwroty i typy transakcji,
- odrzucenia, saldo, OTP i oferty,
- waluty niejednoznaczne,
- maskowanie długich identyfikatorów,
- unikalność nonce, AAD i wykrycie manipulacji,
- migracje Room 1 -> 2 -> 3 -> 4, w tym zakres profilu i domu dla deduplikacji oraz źródeł,
- ręczny kontrakt wydatku,
- częściowy wynik batcha,
- duplikat po usunięciu wydatku,
- kompatybilność starej i rozszerzonej koperty E2EE.

Moduł kompiluje się z `compileSdk=35`, aplikacja używa `targetSdk=35` i `minSdk=24`. Core library desugaring zapewnia obsługę używanego API `java.time` również na Androidzie 7.

Testy instrumentalne wymagają instalacji testowego APK, dlatego uruchamiaj je tylko po osobnej zgodzie właściciela urządzenia:

```powershell
.\gradlew.bat :homeapp-notification-expense-import:connectedDebugAndroidTest
```

Sama kompilacja testów nie instaluje APK:

```powershell
.\gradlew.bat :homeapp-notification-expense-import:compileDebugAndroidTestKotlin
```

## Checklista ręczna

1. Włącz systemowy dostęp do powiadomień.
2. Wyślij zwykłe powiadomienie z aplikacji niewybranej i sprawdź, że pojawia się wyłącznie na liście źródeł.
3. Włącz źródło.
4. Wyślij przykładową płatność i sprawdź kolejkę po zamknięciu procesu HomeApp.
5. Wyślij aktualizację tego samego powiadomienia i sprawdź brak duplikatu.
6. Sprawdź OTP, saldo, odrzucenie i ofertę — nie mogą trafić do kolejki.
7. Zatwierdź kilka poprawnych pozycji i jedną z błędną pozycją budżetu.
8. Ponów tę samą paczkę i sprawdź status `duplicate`.
9. Usuń zatwierdzony wydatek, ponów import i ponownie sprawdź `duplicate`.
10. Zmień aktywny dom i sprawdź izolację kolejki.
11. Odbierz `finances/create` i sprawdź zatrzymanie przechwytywania/zatwierdzania.
12. Sprawdź dom z E2EE zablokowanym i odblokowanym.
13. Sprawdź zmianę godziny/strefy i prywatną treść przypomnienia.
14. Usuń lub unieważnij klucz testowy i sprawdź stan `unavailable` oraz reset.
15. Zaktualizuj aplikację z poprzedniego builda i sprawdź migrację Room bez utraty danych.

## Publikacja w Google Play

Przed przejściem do systemowego ekranu dostępu aplikacja powinna pokazać zrozumiałe wyjaśnienie: dlaczego czyta powiadomienia, jakie dane wykorzystuje, że parser działa lokalnie i że użytkownik może odmówić. Wersję publikowaną trzeba ocenić łącznie z całą polityką danych aplikacji.

Do sprawdzenia przed wysłaniem:

- prominent disclosure i możliwość rezygnacji,
- aktywny link do polityki prywatności w aplikacji i Play Console,
- aktualna deklaracja Data safety, także dla bibliotek zewnętrznych,
- opis lokalnego przetwarzania danych finansowych,
- nagranie przepływu disclosure/zgody, jeżeli Play Console go zażąda,
- brak niepotrzebnych uprawnień i brak `QUERY_ALL_PACKAGES`,
- poprawna obsługa odmowy lub cofnięcia dostępu,
- podpis sklepu, Google OAuth, numer wersji i test aktualizacji.

Oficjalne źródła:

- Android `NotificationListenerService`: https://developer.android.com/reference/android/service/notification/NotificationListenerService
- Android 13 `POST_NOTIFICATIONS`: https://developer.android.com/develop/ui/compose/notifications/notification-permission
- Google Play — prominent disclosure: https://support.google.com/googleplay/android-developer/answer/11150561
- Google Play — Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play — przygotowanie aplikacji do weryfikacji: https://support.google.com/googleplay/android-developer/answer/9859455

Zasady sklepu mogą się zmieniać. Przed każdą publikacją należy ponownie sprawdzić aktualne wymagania w oficjalnej dokumentacji.
