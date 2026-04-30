# QA mobile notes

Data przegladu: 2026-04-27.

Zakres: frontend mobile i ryzyka integracyjne dla ekranow Finanse, Plan, Dom/Wiecej, Zakupy oraz realtime. Nie zmieniano kodu aplikacji ani checklisty MVP.

## Najwazniejsze ryzyka

1. Mobile API ma obecnie tylko auth, tworzenie domu, dashboard startowy, permissions i shopping. Brakuje wrapperow w `apps/mobile/src/api/endpoints.ts` dla finansow, planu, domu i wiekszosci ekranu Wiecej, mimo ze backend ma kontrolery dla tych modulow.
2. Ekrany `finanse.tsx`, `plan.tsx`, `dom.tsx` i `wiecej.tsx` sa statycznymi placeholderami. Nie pobieraja danych, nie sprawdzaja uprawnien wewnatrz ekranu i nie wykonuja mutacji.
3. Realtime jest podlaczony globalnie w tab layout, a backend publikuje zdarzenia dla wielu modulow, ale realny efekt w mobile bedzie widoczny tylko dla query, ktore istnieja. Dzisiaj najbardziej testowalne jest `shopping.changed` i `start` invalidowany przez finance/calendar/meal/todo.
4. Debug APK na fizycznym telefonie nie powinno uzywac domyslnego `http://localhost:3000/api`, bo `localhost` oznacza telefon. Trzeba uruchamiac Metro/dev build z `EXPO_PUBLIC_API_URL=http://<ip-komputera>:3000/api`.
5. Android ma `INTERNET`, a debug manifest wlacza `android:usesCleartextTraffic="true"`, wiec HTTP po LAN jest dopuszczone dla debug. Backend domyslnie slucha na `0.0.0.0:3000`, ale trzeba potwierdzic firewall i dostep telefonu do `http://<ip>:3000/api/health`.

## Finanse

Backend:
- `GET /api/finance/current-month`
- `POST /api/finance/months/generate-next`
- `GET /api/finance/months/archive`
- `GET /api/finance/months/:id`
- `GET /api/finance/months/:id/person-summary`
- `GET/POST/PATCH /api/finance/categories`
- `POST/PATCH/DELETE /api/finance/budget-items`
- `POST/DELETE /api/finance/expenses`
- `PUT /api/finance/incomes/:memberId`

Ryzyka:
- Brak mobile endpointow i typow dla powyzszych tras. Ekran Finanse nie korzysta nawet z `GET /finance/current-month`; pokazuje tylko dwa statyczne kafle.
- W DTO zapisu backend oczekuje liczb dla `budgetAmount`, `amount`, `displayOrder`, ale podsumowania backendu zwracaja kwoty jako stringi. Mobile musi konsekwentnie mapowac input number -> API i response string -> UI.
- Wymagane permissions: `finances:read/create/update/delete`. Tab jest ukrywany po braku `read`, ale sam ekran nie ma obslugi read-only, loaderow ani bledow.
- Realtime: backend publikuje `finance.changed` i `finance.month.generated`; mobile invaliduje `queryKeys.start` i `queryKeys.finances`. Poniewaz Finanse nie ma query, realnie odswiezy sie tylko Start dashboard po zdarzeniu finansowym.

Checkboxy checklisty, ktore mozna zamknac po mobile: zadne z sekcji Finanse nie powinny byc zamykane na podstawie obecnego mobile. Backend moze miec te punkty zrobione, ale mobile nie daje przeplywu uzytkownika.

## Plan

Backend:
- Kalendarz: `GET/POST/PATCH/DELETE /api/calendar/events`, `GET /api/calendar/upcoming`.
- Todo: `GET/POST/PATCH/DELETE /api/todo-items`, `POST /api/todo-items/:id/done`, `POST /api/todo-items/:id/reopen`.
- Meal planner i notes maja kontrolery w backendzie, ale mobile API nie ma wrapperow dla tych modulow.

Ryzyka:
- Ekran Plan jest placeholderem. Nie listuje posilkow, wydarzen, todo ani notatek.
- Brak mobile typow dla DTO planu. Dla kalendarza trzeba pilnowac `eventDate` w formacie `YYYY-MM-DD`, opcjonalnego `eventTime` `HH:mm` lub `HH:mm:ss`, `scopeType: household|member` oraz `ownerMemberId` przy wpisach osobowych. Dla todo backend wymaga `scopeType`, a przy `member` waliduje `ownerMemberId`.
- Wymagane permissions: `meal_planner`, `calendar`, `todo`, `notes` z odpowiednimi akcjami. Tab Plan pokazuje sie, jesli user ma read do przynajmniej jednego z tych modulow, ale ekran nie rozdziela uprawnien per sekcja.
- Realtime invaliduje `meal`, `calendar`, `todo`, `notes`, lecz bez query ekranowych nie ma co odswiezac. Start moze odswiezyc wydarzenia, posilki i todo preview.

Checkboxy checklisty, ktore mozna zamknac po mobile: zadne z sekcji Jedzenie, Kalendarz oraz To-do i notatki. Dla mobile widac tylko statyczna nawigacje do planu.

## Dom / Wiecej

Backend ma moduly dla sprzatania, kosztow rocznych, danych, zalacznikow, household members, invitations i permissions. Mobile API nie ma wrapperow dla sprzatania, kosztow rocznych, danych, zalacznikow, household members ani invitations. Jest tylko `getMyPermissions`.

Ryzyka:
- `dom.tsx` i `wiecej.tsx` sa placeholderami. Tab visibility dziala przez permissions, ale po wejsciu nie ma list, formularzy, uploadu ani zarzadzania czlonkami/uprawnieniami.
- Zalaczniki beda wymagaly osobnego QA dla permissions Androida i wyboru plikow. Manifest ma legacy `READ_EXTERNAL_STORAGE` i `WRITE_EXTERNAL_STORAGE`, ale na nowszych Androidach moze byc potrzebne podejscie przez system picker albo nowsze permissiony medialne, zalezne od implementacji uploadu.
- Wiecej: zarzadzanie domem i uprawnieniami wymaga osobnej obslugi owner/member, stanu utraty dostepu oraz odswiezenia `permissions.changed`.

Checkboxy checklisty, ktore mozna zamknac po mobile: zadne z sekcji Sprzatanie, Koszty roczne, Dane, Zalaczniki ani zarzadzanie domem/uprawnieniami. Obecny mobile potwierdza tylko ukrywanie tabow wedlug read permissions.

## Zakupy

Backend i mobile sa tu najbardziej spojne:
- `GET /api/shopping-lists`
- `GET /api/shopping-lists/:type/items`
- `POST /api/shopping-lists/:type/items`
- `PATCH /api/shopping-lists/items/:id`
- `DELETE /api/shopping-lists/items/:id`
- `POST /api/shopping-lists/items/:id/check`

Pola mobile sa zgodne z DTO backendu:
- `type`: `daily | long_term`
- create/update: `name`, opcjonalne `quantity`, opcjonalne `displayOrder`
- response: `isChecked`, `checkedAt`, `displayOrder`, `type`, timestampy

Ryzyka:
- Ekran nie korzysta z `updateShoppingItem`, wiec edycja nazwy/ilosci i reorder nie sa dostepne w UI, mimo ze endpoint istnieje.
- `checkShoppingItem` tylko zaznacza produkt. Brakuje reopen/uncheck w backendzie i mobile, jesli UX ma wspierac cofniecie checkboxa.
- Przy mutacjach pending jest globalny dla wszystkich wierszy, wiec kilka przyciskow moze sie blokowac naraz. To bardziej UX niz blocker MVP.
- Wymagane permissions sa dobrze rozdzielone: read blokuje ekran, create pokazuje formularz, update wlacza checkbox, delete pokazuje kosz.

Checkboxy checklisty, ktore mozna realnie zamknac po mobile po smoke tescie na urzadzeniu: dwie listy, dodanie pozycji, ilosc, checkbox, wyszarzenie zaznaczonych i spadanie zaznaczonych na dol. To wymaga potwierdzenia na prawdziwym API/LAN, nie tylko przegladu kodu.

## Realtime

Stan:
- Backend expose: `GET /api/realtime/events` jako SSE za JWT i kontekstem household.
- Mobile subskrybuje w `app/(tabs)/_layout.tsx` przez fetch stream i invaliduje query keys wedlug typu eventu.
- Backend publikuje zdarzenia dla finance, meal, calendar, todo, notes, shopping, cleaning, annual costs, data entries, attachments, permissions i household.

Ryzyka:
- React Native fetch streaming moze nie byc dostepny we wszystkich konfiguracjach. Kod robi no-op, jesli brakuje `ReadableStream`, wiec realtime moze cicho nie dzialac bez widocznego bledu.
- Brak reconnect/backoff po zerwaniu SSE. Po utracie polaczenia aplikacja nie wznawia streamu, dopoki komponent nie zamontuje sie ponownie albo token/enabled sie nie zmieni.
- `permissions.changed` invaliduje permissions, ale widocznosc tabow odswiezy sie dopiero po skutecznym SSE i refetchu. Warto testowac scenariusz: owner odbiera read drugiemu userowi, drugi user ma otwarty mobile.
- Checklisty realtime nie zamykac bez testu dwoma sesjami/uzytkownikami na LAN.

Checkboxy checklisty, ktore mozna zamknac po mobile: po udanym tescie dwoma klientami mozna zamknac `zmiany zakupow odswiezaja zakupy`. `zmiany finansow/plan/dom i uprawnien` sa czesciowo przygotowane przez invalidacje, ale bez ekranowych query dla tych modulow nie powinny byc uznane za pelne mobile.

## LAN / debug APK

Do sprawdzenia przed testem APK:
- API: `HOST=0.0.0.0`, port `3000`, health pod `http://<ip-komputera>:3000/api/health`.
- Mobile dev: `EXPO_PUBLIC_API_URL=http://<ip-komputera>:3000/api`.
- Metro dla debug APK: `pnpm.cmd --filter @homeapp/mobile dev -- --host lan` albo `scripts/start-mobile-dev.cmd -ApiUrl 'http://<ip>:3000/api' -HostMode lan`.
- Firewall: uruchomic `scripts/open-firewall-dev.cmd` i sprawdzic `scripts/check-lan-dev.cmd`.
- Android: `INTERNET` jest w main manifest, a debug manifest wlacza cleartext HTTP.

## LAN / release APK

Do testu bez kabla i bez Metro uzywac `builds/homeapp-release.apk`.
- Release APK ma wbudowany JS bundle.
- Aktualny build ma zaszyty adres API `http://192.168.100.109:3000/api`.
- Telefon musi byc w tej samej sieci Wi-Fi, a API musi dzialac na komputerze.
- Main Android manifest wlacza `android:usesCleartextTraffic="true"`, zeby lokalne HTTP po LAN dzialalo takze w release.
- Jesli zmieni sie IP komputera, trzeba przebudowac APK komenda `scripts/build-mobile-release-apk.cmd -ApiUrl 'http://<nowe-ip>:3000/api'`.
- Po poprawce bootowania root layout jawnie chowa splash screen. Jesli app dalej zatrzyma sie na splashu, trzeba zebrac natywny log `adb logcat`, bo oznacza to blad przed zamontowaniem React root.

### 2026-04-28 boot QA

Po raporcie, ze aplikacja nadal stoi na logo, sprawdzono `logcat-homeapp.txt`.
- Nie bylo fatalnego `ReactNativeJS`/`AndroidRuntime`.
- Byly natywne wpisy startu Activity: `no window has focus`, `exp_actresumetimeoutcom.homeapp.mobile`, `NO_INPUT_CHANNEL`.
- To wskazuje problem bootowania natywnego Activity/splash, a nie problem backendu, skoro `/api/health` dziala po LAN.

Zmiany w buildzie `versionCode=2`:
- `MainActivity` nie instaluje juz `SplashScreenManager`.
- Manifest odpala `MainActivity` na `@style/AppTheme`, bez `@style/Theme.App.SplashScreen`.
- Usunieto route-scanned pliki `app/_layout.bak.tsx` i `app/index.bak.tsx`.
- `index.js` wraca do oficjalnego `expo-router/entry`.
- Build release: `builds/homeapp-release-20260428-0651.apk`.

Historyczny smoke test dla builda `20260428-0651`:
1. Odinstalowac poprzednia HomeApp z telefonu.
2. Zainstalowac `builds/homeapp-release.apk` z timestampem `20260428-0651`.
3. Upewnic sie, ze API health dziala z przegladarki telefonu.
4. Uruchomic aplikacje i oczekiwac ekranu logowania albo kontrolowanego ekranu bledu aplikacji, nie stalego logo.

## Rekomendowana kolejka zamykania checklisty mobile

1. Zakupy: smoke test na telefonie z LAN API, potem mozna zamknac checkboxy zakupowe po stronie mobile.
2. Realtime Zakupy: drugi klient/uzytkownik, dodanie i odhaczenie produktu, obserwacja refetchu bez recznego odswiezania.
3. Start dashboard: potwierdzic, ze finance/calendar/meal/todo zmienione poza telefonem odswiezaja Start przez realtime.
4. Dopiero po dodaniu mobile endpointow i ekranow zamykac Finanse, Plan, Dom/Wiecej.

## 2026-04-29 QA - aktywny folder Desktop i debug przez USB

Stan:
- Aktywny folder IDE to `C:\Users\moski\Desktop\homeapp`.
- Stara kopia `C:\homeapp` miala dzialajacy Metro bundle, ale nie byla juz folderem aktywnym w IDE.
- Port `8081` byl zajety przez Metro ze starej kopii. Zatrzymano ten proces i uruchomiono Metro z Desktop.
- Debug build na telefonie wymagal root `index.js`; bez niego Metro zwracalo 404 dla `/index.bundle` z bledem `Unable to resolve module ./index`.

Naprawione:
- Dodano root `index.js`.
- Przeniesiono komplet wspolnych komponentow UI do `apps/mobile/src/ui`.
- Naprawiono build blockery w ekranach tabow.
- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- Telefon po USB uruchamia ekran logowania z Desktop Metro.

Artefakty:
- `adb-desktop-active-2.png` - potwierdza blad 404 przed dodaniem root `index.js`.
- `adb-desktop-active-3.png` - potwierdza dzialajacy ekran logowania po naprawie.
- `adb-desktop-active-3.log` - brak krytycznych bledow React Native po starcie.

Ograniczenia QA:
- MIUI blokuje `adb shell input tap` (`INJECT_EVENTS`), wiec nie da sie w pelni automatycznie klikac formularza z komputera.
- Rejestracje/logowanie trzeba teraz przejsc recznie na telefonie.
- Sesja nadal jest tylko w pamieci React state; po pelnym ubiciu aplikacji user wroci do logowania. To trzeba poprawic przed oznaczeniem mobile jako produkcyjnego.

## 2026-04-30 QA - auth, theme i UX pass

Stan:
- Dodano `expo-secure-store` i zapis sesji/e-maila dla opcji `Zapamietaj mnie`.
- `app.json` ma `userInterfaceStyle: automatic` oraz plugin `expo-secure-store`.
- Auth ma reset hasla, oko hasla, pasek sily hasla, checkboxy regulaminu/polityki, podglady dokumentow oraz przyciski Google/Apple.
- Start, Zakupy i Finanse zostaly przebudowane wizualnie w kierunku bardziej produkcyjnego dashboardu i list operacyjnych.
- Plan, Dom i Wiecej zostaly przepiete na dynamiczny motyw i bardziej czytelne sekcje modulowe.
- Wspolne komponenty UI korzystaja juz z `useAppTheme`, wiec dark mode ma wspolny fundament.
- Zbudowano nowy release APK po dodaniu natywnego modulu: `builds/homeapp-release-20260430-0751.apk`.

Sprawdzenia:
- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `pnpm.cmd --filter @homeapp/mobile test` - OK, brak testow mobilnych.
- `pnpm.cmd --filter @homeapp/api typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api test` - OK, 14 testow przeszlo.
- `scripts/build-mobile-release-apk.cmd -ApiUrl 'http://192.168.100.109:3000/api'` - OK, ostatni build `20260430-0751`.
- API health lokalnie - OK.
- ADB nie widzial telefonu w momencie testu, wiec brak aktualnego screenshotu po zmianach.

Ryzyka:
- Po dodaniu `expo-secure-store` trzeba przebudowac Android dev/release build; stary dev client moze nie miec natywnego modulu.
- W tamtym etapie APK testowy to `builds/homeapp-release.apk` albo `builds/homeapp-release-20260430-0751.apk`; starsze APK nie maja pewnego wsparcia nowego natywnego modulu.
- Google/Apple sa przygotowane w UI, ale pelny OAuth nadal wymaga konfiguracji klientow i backendu.
- `C:\homeapp` jest pusty, lecz sam katalog pozostaje zablokowany przez proces Windows. Nie ma juz w nim drugiej kopii projektu.
- Nie zamykac checkboxow auth/mobile tylko po review kodu; trzeba przejsc recznie rejestracje/logowanie/reset na telefonie.

## 2026-04-30 QA - produkcyjne utwardzenie

Stan:
- Backend Google OAuth nie jest juz slepym endpointem: uzywa `google-auth-library` i wymaga `GOOGLE_OAUTH_CLIENT_ID`.
- Dodano `google_subject` do tabeli `users`; migracja lokalna wykonana.
- `NODE_ENV=production` blokuje domyslne sekrety JWT, domyslny URL bazy i localhostowy `APP_PUBLIC_URL`.
- Backend nie zwraca tokenow developerskich resetu/weryfikacji w produkcji.
- Mobile odswieza access token przed wygasnieciem i umie odtworzyc zapamietana sesje przez refresh token.
- Realtime SSE ma reconnect z backoffem.
- Poprzedni APK testowy z tego etapu: `builds/homeapp-release-20260430-1750.apk`.

Sprawdzenia:
- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd test` - OK.
- `pnpm.cmd build` - OK.
- `pnpm.cmd --filter @homeapp/api db:migrate` - OK.
- `scripts/build-mobile-release-apk.cmd -ApiUrl 'http://192.168.100.109:3000/api'` - OK.

Ryzyka pozostale przed produkcja:
- Google login wymaga jeszcze prawdziwych client ID i testu end-to-end.
- Produkcyjna wysylka e-mail zostala dodana w kolejnym etapie, ale nadal wymaga realnego SMTP smoke testu.
- Realtime reconnect wymaga testu dwoma sesjami, bo sam kod nie potwierdza zachowania na realnym telefonie.
- Nadal brak automatycznych testow UI mobile; smoke test na APK jest wymagany przed zamknieciem checklisty.

## 2026-04-30 QA - auth e-mail, deep linki i rate limit

Stan:
- Backend ma modul mailowy z `MAIL_DRIVER=console|smtp`; produkcja wymaga SMTP zamiast tokenow developerskich.
- Linki verify/reset sa budowane na `AUTH_LINK_BASE_URL`, domyslnie `homeapp://auth`.
- Mobile obsluguje deep link verify/reset i ma akcje ponownego wyslania linku weryfikacyjnego.
- Kontroler auth ma prosty rate limit przez `AUTH_RATE_LIMIT_MAX` i `AUTH_RATE_LIMIT_WINDOW_SECONDS`.
- Android release build obsluguje produkcyjny keystore przez `HOMEAPP_ANDROID_KEYSTORE_*`; aktualny APK testowy nadal uzywa debugowego podpisu, bo env keystore nie sa ustawione.
- Tymczasowe bundle `apps/mobile/tmp-*` zostaly usuniete i dodane do `.gitignore`.
- Aktualny APK testowy: `builds/homeapp-release-20260430-1838.apk`.

Sprawdzenia:
- `pnpm.cmd --filter @homeapp/api typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api lint` - OK.
- `pnpm.cmd --filter @homeapp/api test` - OK, 20 testow.
- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `pnpm.cmd --filter @homeapp/mobile test` - OK, brak testow mobile.
- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd test` - OK.
- `pnpm.cmd build` - OK.
- `scripts/build-mobile-release-apk.cmd -ApiUrl 'http://192.168.100.109:3000/api'` - OK.

Ryzyka pozostale przed produkcja:
- Nie wykonano realnego SMTP smoke testu; potrzebne dane serwera SMTP albo provider transakcyjny.
- Deep linki verify/reset wymagaja testu na fizycznym telefonie z zainstalowanym `homeapp-release-20260430-1838.apk`.
- Google OAuth wymaga prawdziwych client ID i testu end-to-end.
- APK jest lokalnym release buildem do testow, nie finalnie podpisanym buildem sklepowym.

## 2026-04-30 QA - ADB smoke przygotowany, telefon niewidoczny

Stan:
- Backend zrestartowany z aktualnego repo; `GET /api/health` dziala na porcie 3000.
- Dodano `scripts/android-debug-smoke.cmd` / `.ps1` do automatycznego testu na telefonie.
- Skrypt zbiera: install/start APK, screenshot, UI dump i logcat.
- Windows wykrywa `HUAWEI P30 Pro` jako WPD/MTP, ale `adb devices -l` nadal nie pokazuje urzadzenia.

Wynik:
- `scripts/android-debug-smoke.cmd` konczy sie komunikatem `No ADB device found`.

Do wykonania na telefonie:
- Wlaczyc `Opcje programistyczne`.
- Wlaczyc `Debugowanie USB`.
- Na Huawei sprawdzic opcje zwiazane z `ADB/HDB` i debugowaniem w trybie ladowania.
- Zaakceptowac prompt RSA/debugowania USB na ekranie telefonu.
- Po tym ponownie uruchomic `adb devices -l`; wymagany status to `device`.
