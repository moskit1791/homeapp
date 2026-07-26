# Progress HomeApp

## 2026-04-26 - Etap 0 - organizacja pracy

### Zakres

- Utworzenie dokumentów agentów w `docs/agents`.
- Przygotowanie zasad aktualizowania checklisty MVP.
- Ustalenie, że dokumentacja robocza trafia do `docs`.

### Pliki

- `docs/agents/README.md`
- `docs/agents/bootstrap-agent.md`
- `docs/agents/db-agent.md`
- `docs/agents/api-agent.md`
- `docs/agents/mobile-agent.md`
- `docs/agents/qa-agent.md`
- `docs/progress.md`

### Decyzje

- Checklistę akceptacji aktualizujemy tylko po realnym spełnieniu danego warunku.
- Backend-first pozostaje obowiązującą kolejnością.
- Lokalny PostgreSQL jest domyślną bazą developmentową.

### Testy

- Nie dotyczy, etap dokumentacyjny.

### Checklist items

- Brak zmian w checklistach funkcjonalnych, bo etap 0 nie dostarcza jeszcze funkcji MVP.

### Blokery

- Do sprawdzenia: dostępność `pnpm`, `psql` i lokalnego PostgreSQL.

### Następny krok

- Etap 1: bootstrap repozytorium i monorepo.

## 2026-04-26 - Etap 1 - bootstrap repozytorium

### Zakres

- Zainicjalizowano repozytorium Git.
- Przygotowano monorepo `pnpm + turbo`.
- Dodano root config TypeScript, ESLint, Prettier i workspace.
- Dodano pakiety współdzielone `shared-types` i `shared-validation`.
- Dodano skeleton API NestJS z health endpointem.
- Dodano skeleton Expo Router z dolnymi tabami i prostym design systemem inspirowanym Minimal UI.

### Pliki

- `.editorconfig`
- `.gitattributes`
- `.gitignore`
- `.npmrc`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.base.json`
- `README.md`
- `apps/api/**`
- `apps/mobile/**`
- `packages/eslint-config/**`
- `packages/shared-types/**`
- `packages/shared-validation/**`
- `packages/tsconfig/**`

### Decyzje

- W PowerShell używać `pnpm.cmd`, bo systemowa polityka blokuje `pnpm.ps1`.
- `corepack enable` nie zadziałał bez uprawnień administratora; `pnpm@9.15.4` został zainstalowany przez npm w profilu użytkownika.
- API dev runtime używa `ts-node`, bo `tsx` powodował problem z dekoratorami NestJS w tym środowisku.
- Expo Router wymaga `main: "expo-router/entry"` oraz jawnej zależności `@babel/runtime` przy tym monorepo.

### Testy

- `pnpm.cmd install` - OK.
- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd build` - OK, w tym Expo export Android/iOS.
- `pnpm.cmd test` - OK, obecnie bez testów domenowych.
- API smoke: `GET http://localhost:3000/api/health` zwróciło `{"status":"ok","service":"homeapp-api"}`.

### Checklist items

- Brak zaznaczonych punktów checklisty MVP. Etap 1 dostarcza fundament techniczny, ale nie kończy jeszcze żadnego flow funkcjonalnego z checklisty akceptacji.

### Blokery

- Bloker zdjęty później: lokalny PostgreSQL 18 został zainstalowany i działa jako `postgresql-x64-18`.

### Następny krok

- Etap 2: instalacja/uruchomienie lokalnego PostgreSQL i odpalenie migracji.

## 2026-04-26 - Etap 2 - schemat bazy danych

### Zakres

- Dodano pierwszą migrację SQL ze strukturą tabel zgodną ze specyfikacją.
- Dodano enumy, constrainty, indeksy i widoki agregujące.
- Szczególnie zabezpieczono: jeden aktywny dom na użytkownika, jeden owner na dom, jeden bieżący miesiąc budżetowy na dom, dodatnie wydatki.
- Dodano runner migracji po stronie API.
- Dodano instrukcję lokalnego uruchomienia.

### Pliki

- `db/migrations/202604260001_initial_schema.sql`
- `apps/api/src/scripts/migrate.ts`
- `docs/local-development.md`

### Decyzje

- Migracje są SQL-first.
- `spent_amount` nie jest kolumną źródłową; wynika z `expenses` w widoku `v_budget_item_totals`.
- `remaining_amount` w widoku pozycji budżetowej jest liczone jako `budget_amount - spent_amount`.
- Widok podsumowania osoby sumuje budżety, wydatki i pozostało po pozycjach budżetowych.

### Testy

- Migracja została odpalona na lokalnej bazie `homeapp_dev`: `Applied migration 202604260001_initial_schema.sql`.
- Weryfikacja schematu: 25 tabel bazowych, 4 widoki agregujące.
- Potwierdzone widoki: `v_budget_item_totals`, `v_budget_person_summary`, `v_cleaning_overview`, `v_annual_cost_history_by_year`.
- Potwierdzone indeksy: `budget_months_one_current_per_household`, `household_members_one_active_household_per_user`, `household_members_one_owner_per_household`.
- Static checks projektu: `typecheck`, `lint`, `build`, `test` - OK.
- Po dodaniu runnera migracji: `pnpm.cmd typecheck` - OK, `pnpm.cmd lint` - OK.

### Checklist items

- Brak zaznaczonych punktów checklisty MVP. Schemat jest przygotowany, ale punkty akceptacji wymagają działających endpointów i uruchomionej bazy.

### Blokery

- Brak blokera DB po instalacji PostgreSQL 18.
- `psql` nie jest w PATH; działa pełna ścieżka `C:\Program Files\PostgreSQL\18\bin\psql.exe`.

### Następny krok

- Rozpocząć endpointy auth/household/permissions na działającym schemacie.

## 2026-04-26 - Etap 2.5 - szkielet modułów API

### Zakres

- Dodano wszystkie moduły backendowe wskazane w specyfikacji.
- Dodano osobne serwisy finansowe jako przygotowanie pod etap krytyczny finansów.
- Podłączono moduły do `AppModule`.

### Pliki

- `apps/api/src/app.module.ts`
- `apps/api/src/modules/users/**`
- `apps/api/src/modules/households/**`
- `apps/api/src/modules/invitations/**`
- `apps/api/src/modules/permissions/**`
- `apps/api/src/modules/finance/**`
- `apps/api/src/modules/meal-planner/**`
- `apps/api/src/modules/calendar/**`
- `apps/api/src/modules/todo/**`
- `apps/api/src/modules/notes/**`
- `apps/api/src/modules/shopping/**`
- `apps/api/src/modules/cleaning/**`
- `apps/api/src/modules/annual-costs/**`
- `apps/api/src/modules/data-entries/**`
- `apps/api/src/modules/attachments/**`

### Decyzje

- Backend pozostaje modularnym monolitem NestJS.
- Finanse mają osobne serwisy: miesiące, kategorie, pozycje, wydatki, dochody i podsumowania.

### Testy

- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd build` - OK.
- `pnpm.cmd test` - OK, nadal bez testów domenowych.

### Checklist items

- Brak zaznaczonych punktów checklisty MVP. Moduły są szkieletem, nie działającą funkcjonalnością akceptacyjną.

### Blokery

- Historyczne: ten blocker przestał obowiązywać po decyzji o rezygnacji z Supabase.

### Następny krok

- Uruchomić lokalny PostgreSQL i rozpocząć implementację auth/dom/uprawnienia na prawdziwych tabelach.

## 2026-04-26 - Etap 3/4 - podstawy auth, household context i permissions

### Zakres

- Dodano lokalny guard JWT Bearer token.
- Dodano kontekst użytkownika i domu na request.
- Dodano guard aktywnego członkostwa w domu.
- Dodano dekorator `RequirePermission` i guard uprawnień per moduł/akcja.
- Dodano zapytania serwisów dla lokalnego użytkownika, aktywnego członkostwa i permission checks.
- Dodano kontroler `/auth` dla rejestracji, logowania, Google, resetu hasła, weryfikacji e-mail, refresh i logout.
- Dodano kontroler `/households` dla tworzenia domu, pobierania/edycji domu, członków, zaproszeń i uprawnień członka.

### Pliki

- `apps/api/src/shared/request-context.ts`
- `apps/api/src/shared/decorators/current-user.decorator.ts`
- `apps/api/src/shared/decorators/current-household.decorator.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/dto/auth.dto.ts`
- `apps/api/src/modules/auth/guards/jwt-auth.guard.ts`
- `apps/api/src/modules/households/guards/household-context.guard.ts`
- `apps/api/src/modules/households/households.controller.ts`
- `apps/api/src/modules/households/dto/household.dto.ts`
- `apps/api/src/modules/permissions/decorators/require-permission.decorator.ts`
- `apps/api/src/modules/permissions/guards/permission.guard.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/api/src/modules/households/households.module.ts`
- `apps/api/src/modules/households/households.service.ts`
- `apps/api/src/modules/permissions/permissions.module.ts`
- `apps/api/src/modules/permissions/permissions.service.ts`

### Decyzje

- Pierwotny auth przez Supabase został zastąpiony własnym backend auth.
- Konto `banned` jest blokowane w guardzie.
- Owner ma pełny dostęp bez sprawdzania tabeli `member_permissions`.
- Guard permissions nie jest jeszcze globalny; będzie używany na kontrolerach domenowych przez `@UseGuards(...)`.

### Testy

- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd build` - OK.
- `pnpm.cmd test` - OK, nadal bez testów domenowych.
- API smoke z `DATABASE_URL` do `homeapp_dev`: `GET /api/health` zwrócił `{"status":"ok","service":"homeapp-api"}`.
- Proces dev serwera został zamknięty po smoke teście.

### Checklist items

- Brak zaznaczonych punktów checklisty MVP. Endpointy auth/household istnieją, ale akceptacja wymaga testów integracyjnych i przejścia pełnych flow.

### Blokery

- Brak blokera Supabase: auth jest lokalny.

### Następny krok

- Dodać testy integracyjne DB dla household/permissions oraz rozpocząć moduł finansów.

## 2026-04-26 - Decyzja architektoniczna - rezygnacja z Supabase

### Zakres

- Użytkownik zdecydował, że aplikacja nie będzie używać Supabase.
- Auth przechodzi na własną implementację backendową.
- Storage będzie implementowany później jako lokalny/S3-compatible moduł, bez Supabase Storage.

### Decyzje

- Hasła są hashowane w backendzie.
- Access token to JWT podpisany `JWT_ACCESS_SECRET`.
- Refresh token jest opaque, przechowywany w bazie tylko jako SHA-256 hash.
- Weryfikacja e-mail i reset hasła generują tokeny backendowe; do czasu integracji z e-mailem endpointy zwracają tokeny developerskie.
- Google OAuth nie jest częścią własnego lokalnego auth bez konfiguracji Google OAuth; endpoint zwraca `501 Not Implemented` do czasu dodania Google client id/secret.

### Checklist items

- Nadal brak zaznaczonych punktów auth w checkliście. Najpierw trzeba dodać testy integracyjne i wykonać pełne flow.

## 2026-04-26 - Etap 3/4 - własny backend auth

### Zakres

- Usunięto zależność API od Supabase Auth.
- Dodano migrację `202604260002_custom_auth.sql`.
- Przeniesiono migracje z `supabase/migrations` do `db/migrations`.
- Dodano lokalny backend auth: hashowanie haseł, JWT access token, opaque refresh tokeny w bazie, token weryfikacji e-mail i token resetu hasła.
- Zmieniono auth guard z Supabase Bearer token na własny `JwtAuthGuard`.
- Zaktualizowano env: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, TTL tokenów oraz lokalny storage driver.

### Pliki

- `db/migrations/202604260001_initial_schema.sql`
- `db/migrations/202604260002_custom_auth.sql`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/guards/jwt-auth.guard.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/api/src/modules/households/households.module.ts`
- `apps/api/src/modules/households/households.controller.ts`
- `apps/api/src/shared/env.ts`
- `apps/api/.env.example`
- `apps/api/src/scripts/migrate.ts`
- `README.md`
- `docs/agents/api-agent.md`
- `docs/local-development.md`
- `docs/checklista_mvp_i_akceptacji_v2.md`

### Decyzje

- Refresh token nie jest JWT; jest losowym tokenem, a baza przechowuje tylko SHA-256 hash.
- Endpointy verify/reset zwracają token developerski do czasu dodania wysyłki e-mail.
- Google OAuth pozostaje endpointem `501 Not Implemented`, bo wymaga konfiguracji Google OAuth, nie Supabase.
- Shared packages przełączono na CommonJS, żeby zbudowane API mogło działać przez `node dist/main.js`.

### Testy

- `pnpm.cmd --filter @homeapp/api db:migrate` - OK, zastosowano `202604260002_custom_auth.sql`.
- Weryfikacja DB: kolumny `password_hash`, `email_verified_at`, `password_reset_token_hash` istnieją w `users`.
- Weryfikacja DB: tabela `auth_refresh_tokens` istnieje.
- Smoke flow lokalny: `POST /auth/register` - OK.
- Smoke flow lokalny: `POST /auth/login` - OK.
- Smoke flow lokalny: `POST /households` z Bearer JWT - OK, utworzono household.
- Serwer testowy został zatrzymany po smoke flow.
- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd build` - OK.
- `pnpm.cmd test` - OK, nadal bez formalnych testów integracyjnych.

### Checklist items

- Zaznaczono `rejestracja e-mail + hasło działa`.
- Zaznaczono `logowanie e-mail + hasło działa`.
- Zaznaczono `utworzenie domu działa`.
- Nie zaznaczono jeszcze Google OAuth, verify email, reset hasła, zaproszeń, banowania ani permissions, bo nie przeszły pełnego flow/testów.

### Następny krok

- Dodać testy integracyjne auth/household/permissions i przejść do finansów.

## 2026-04-26 - QA - strategia testów auth/household/permissions

### Zakres

- Dopisano strategię testów integracyjnych dla własnego backend auth po rezygnacji z Supabase.
- Rozpisano minimalne scenariusze integracyjne dla auth, household context i permissions.
- Dodano lekkie testy jednostkowe bez zewnętrznej bazy dla weryfikacji JWT access tokenów i `PermissionGuard`.

### Pliki

- `docs/agents/qa-agent.md`
- `docs/progress.md`
- `apps/api/src/modules/auth/auth.service.spec.ts`
- `apps/api/src/modules/households/guards/permission.guard.spec.ts`

### Decyzje

- Formalne testy integracyjne powinny używać osobnej bazy `homeapp_test` albo równoważnego resetu schematu, a nie mocków `DatabaseService`.
- Refresh token w testach integracyjnych trzeba sprawdzać jako opaque token z hashem SHA-256 w bazie.
- Unit testy dodane teraz nie dotykają PostgreSQL i nie uruchamiają endpointów.

### Testy

- `pnpm.cmd --filter @homeapp/api test` - OK, 2 pliki testowe, 8 testów.
- `pnpm.cmd --filter @homeapp/api lint` - OK.
- `pnpm.cmd --filter @homeapp/api typecheck` - BLOKUJE istniejący błąd poza zakresem QA w `apps/api/src/modules/shopping/shopping.service.ts`: `ShoppingItemRow | undefined` przekazywany tam, gdzie wymagany jest `ShoppingItemRow`.

### Checklist items

- Brak zmian w checklistach funkcjonalnych. To etap QA/test strategy, a nie potwierdzenie pełnych flow integracyjnych.

### Następny krok

- Dodać setup integracyjnej bazy testowej i przełożyć powyższe scenariusze na testy API.

## 2026-04-26 - Etap 5 - finanse, zakupy i dane smoke

### Zakres

- Zaimplementowano pełny backend modułu finansów MVP: miesiąc bieżący, kategorie, pozycje budżetowe, wydatki, dochody, podsumowania, archiwum i generowanie kolejnego miesiąca.
- Dodano automatyczne utworzenie pierwszego miesiąca budżetowego i zerowego dochodu właściciela przy tworzeniu domu.
- Dodano migrację naprawczą dla istniejących domów bez miesiąca budżetowego.
- Zintegrowano prace agentów dla `ShoppingModule` i `DataEntriesModule`.
- Naprawiono runtime DI NestJS dla modułów domenowych używających `JwtAuthGuard`.

### Agenci

- Codex główny: finanse, inicjalizacja miesiąca, migracja backfill, integracja i smoke.
- Descartes: backend zakupów.
- Laplace: backend danych title/value.
- Tesla: testy jednostkowe auth/permission guard i strategia QA.

### Pliki

- `apps/api/src/modules/finance/finance.controller.ts`
- `apps/api/src/modules/finance/finance.module.ts`
- `apps/api/src/modules/finance/dto/finance.dto.ts`
- `apps/api/src/modules/finance/services/budget-months.service.ts`
- `apps/api/src/modules/finance/services/budget-categories.service.ts`
- `apps/api/src/modules/finance/services/budget-items.service.ts`
- `apps/api/src/modules/finance/services/expenses.service.ts`
- `apps/api/src/modules/finance/services/incomes.service.ts`
- `apps/api/src/modules/finance/services/finance-summary.service.ts`
- `apps/api/src/modules/households/households.service.ts`
- `apps/api/src/modules/shopping/**`
- `apps/api/src/modules/data-entries/**`
- `db/migrations/202604260003_backfill_initial_budget_months.sql`
- `docs/checklista_mvp_i_akceptacji_v2.md`

### Decyzje

- Mutacje finansowe działają na bieżącym miesiącu; archiwalne miesiące są czytelne, ale dochód archiwalny nie jest modyfikowany przez endpoint aktualizacji dochodu.
- Generowanie kolejnego miesiąca kopiuje układ pozycji, kopiuje kwoty tylko dla kategorii z flagą `copy_budget_to_next_month` i nie kopiuje wydatków.
- Owner nadal przechodzi przez te same guardy requestu, ale ma pełny dostęp przez bypass w `PermissionGuard`.

### Testy

- `pnpm.cmd --filter @homeapp/api typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api lint` - OK.
- `pnpm.cmd --filter @homeapp/api build` - OK.
- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd build` - OK.
- `pnpm.cmd test` - OK, 2 pliki testowe API, 8 testów.
- `pnpm.cmd --filter @homeapp/api db:migrate` - OK, zastosowano `202604260003_backfill_initial_budget_months.sql`.
- API smoke na lokalnym PostgreSQL - OK:
  - rejestracja, verify e-mail, forgot/reset password, login,
  - utworzenie domu,
  - pobranie bieżącego miesiąca,
  - kategorie, pozycje budżetowe, wydatek, dochód, podsumowanie per osoba,
  - ujemne `remaining`,
  - generowanie kolejnego miesiąca, archiwum i otwarcie archiwalnego miesiąca,
  - brak kopiowania expenses i warunkowe kopiowanie budżetów,
  - dwie listy zakupów, dodanie pozycji z ilością, checkbox i sortowanie zaznaczonych na dół,
  - dodanie wpisu danych i wyszukiwanie.

### Checklist items

- Zaznaczono verify e-mail i reset hasła.
- Zaznaczono `owner ma pełen dostęp`.
- Zaznaczono wszystkie punkty sekcji Finanse.
- Zaznaczono backendowo potwierdzone punkty Zakupów poza wizualnym wyszarzeniem.
- Zaznaczono dodawanie wpisu danych i wyszukiwarkę.

### Blokery

- Google OAuth zostaje na koniec zgodnie z decyzją użytkownika.
- Dołączenie członka do domu i pełne negatywne testy permissions wymagają kolejnego etapu.

### Następny krok

- Etapy 6-8: meal planner, calendar oraz todo/notatki, równolegle z formalizowaniem testów integracyjnych API.

## 2026-04-26 - Etapy 6-8 - jedzenie, kalendarz, todo i notatki

### Zakres

- Zaimplementowano backend MVP dla planera jedzenia:
  - tygodnie planu od poniedziałku,
  - wpisy posiłków w slotach,
  - historia tygodni,
  - kopiowanie tygodnia,
  - inspiracje,
  - losowanie z historii z pominięciem ostatnich 3 tygodni.
- Zaimplementowano backend MVP dla kalendarza:
  - lista wydarzeń w zakresie dat,
  - wydarzenia domowe i przypisane do osoby,
  - zapis/odczyt `recurrence_rule`,
  - najbliższe wydarzenia przez endpoint `upcoming`.
- Zaimplementowano backend MVP dla todo i notatek:
  - zadania domowe i osobowe,
  - status `todo/done`,
  - osobne endpointy todo i notes,
  - CRUD notatek.
- Poprawiono mapowanie pól PostgreSQL `date` na czyste `YYYY-MM-DD` w API dla meal planner i calendar.

### Agenci

- Codex główny: `MealPlannerModule`, integracja i smoke.
- Avicenna: `CalendarModule`.
- Hypatia: `TodoModule` i `NotesModule`.

### Pliki

- `apps/api/src/modules/meal-planner/meal-planner.controller.ts`
- `apps/api/src/modules/meal-planner/meal-planner.module.ts`
- `apps/api/src/modules/meal-planner/meal-planner.service.ts`
- `apps/api/src/modules/meal-planner/dto/meal-planner.dto.ts`
- `apps/api/src/modules/calendar/**`
- `apps/api/src/modules/todo/**`
- `apps/api/src/modules/notes/**`
- `docs/checklista_mvp_i_akceptacji_v2.md`

### Decyzje

- Losowanie jedzenia pomija ostatnie 3 tygodnie i losuje z historii starszej niż to okno.
- `recurrence_rule` w kalendarzu jest na tym etapie zapisywane i odczytywane, ale nie ma jeszcze ekspansji cyklicznych wystąpień, więc checkbox `działa cykliczność` pozostaje otwarty.
- Checkbox `najbliższe wydarzenia widać na starcie` pozostaje otwarty, bo backend ma `GET /calendar/upcoming`, ale ekran Start nie jest jeszcze zintegrowany.
- Checkbox `zadania i notatki są w osobnych zakładkach` pozostaje otwarty do implementacji UI.

### Testy

- `pnpm.cmd --filter @homeapp/api typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api exec eslint src/modules/meal-planner src/modules/calendar src/modules/todo src/modules/notes` - OK.
- `pnpm.cmd --filter @homeapp/api build` - OK.
- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd build` - OK.
- `pnpm.cmd test` - OK, 2 pliki testowe API, 8 testów.
- API smoke na lokalnym PostgreSQL - OK:
  - utworzenie tygodnia planu,
  - wpisanie posiłków do slotów,
  - pobranie bieżącego planu,
  - historia tygodni,
  - kopiowanie tygodnia,
  - inspiracje,
  - losowanie z historii z pominięciem ostatnich 3 tygodni,
  - wydarzenie domowe i osobowe,
  - zapis/odczyt `recurrence_rule`,
  - endpoint `calendar/upcoming`,
  - utworzenie zadania, status done i reopen,
  - utworzenie i edycja notatki.
- Smoke potwierdził też, że `weekStartDate` i `eventDate` wracają jako `YYYY-MM-DD`.

### Checklist items

- Zaznaczono wszystkie backendowo potwierdzone punkty sekcji Jedzenie.
- Zaznaczono dodawanie wydarzenia, wydarzenie dla domu i wydarzenie dla osoby.
- Zaznaczono tworzenie zadania, zmianę statusu todo/done i tworzenie notatki.

### Blokery

- Brak blokerów technicznych dla tych backendowych modułów.
- Do kolejnych etapów zostają: pełna ekspansja cykliczności kalendarza, Start/dashboard, UI zakładek todo/notatki.

### Następny krok

- Etapy 9-11: sprzątanie, koszty roczne i załączniki/storage backend.

## 2026-04-26 - Etapy 9-11 - sprzątanie, koszty roczne i załączniki

### Zakres

- Zaimplementowano backend MVP dla sprzątania:
  - CRUD zadań,
  - częstotliwość i okno realizacji,
  - sortowanie zaległych zadań na górze,
  - `complete` zapisuje historię i wyznacza kolejny termin.
- Zaimplementowano backend MVP dla kosztów rocznych:
  - CRUD kosztów,
  - oznaczanie wykonania,
  - historia wykonania,
  - automatyczne przesunięcie `next_due_date` o rok,
  - historia filtrowana po roku.
- Zaimplementowano backend MVP dla załączników:
  - prywatny lokalny kontrakt uploadu,
  - metadata zdjęć i PDF,
  - podpis,
  - wyszukiwanie po podpisie,
  - brak publicznego URL odczytu pliku.

### Agenci

- Codex główny: `CleaningModule`, integracja i smoke.
- Mendel: `AnnualCostsModule`.
- Arendt: `AttachmentsModule`.

### Pliki

- `apps/api/src/modules/cleaning/cleaning.controller.ts`
- `apps/api/src/modules/cleaning/cleaning.module.ts`
- `apps/api/src/modules/cleaning/cleaning.service.ts`
- `apps/api/src/modules/cleaning/dto/cleaning.dto.ts`
- `apps/api/src/modules/annual-costs/**`
- `apps/api/src/modules/attachments/**`
- `docs/checklista_mvp_i_akceptacji_v2.md`

### Decyzje

- Sprzątanie liczy kolejny termin jako `completed_at + frequency_days`.
- Koszt roczny liczy kolejny termin jako `executed_at + 1 year`.
- Załączniki w MVP nie mają publicznego endpointu pobierania; `upload-url` zwraca prywatny `storagePath` i lokalny kontrakt uploadu.
- Dla modułów domenowych z `JwtAuthGuard` importujemy też `UsersModule`, żeby uniknąć runtime problemów DI w NestJS.

### Testy

- `pnpm.cmd --filter @homeapp/api typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api exec eslint src/modules/cleaning src/modules/annual-costs src/modules/attachments` - OK.
- `pnpm.cmd --filter @homeapp/api build` - OK.
- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd build` - OK.
- `pnpm.cmd test` - OK, 2 pliki testowe API, 8 testów.
- API smoke na lokalnym PostgreSQL - OK:
  - utworzenie zadań sprzątania,
  - ustawienie częstotliwości i okna realizacji,
  - zaległe zadanie na górze listy,
  - `complete` zapisuje historię i wyznacza nowy termin,
  - utworzenie kosztu rocznego,
  - wykonanie kosztu zapisuje historię i przesuwa termin o rok,
  - historia kosztów działa z filtrem `year`,
  - kontrakt uploadu dla JPG i PDF,
  - utworzenie metadata załączników,
  - podpis i wyszukiwanie po podpisie,
  - odpowiedzi załączników nie wystawiają publicznego URL odczytu.

### Checklist items

- Zaznaczono wszystkie punkty sekcji Sprzątanie.
- Zaznaczono wszystkie punkty sekcji Koszty roczne.
- Zaznaczono wszystkie punkty sekcji Załączniki.

### Blokery

- Brak blokerów backendowych dla tych modułów.
- Fizyczny upload pliku do storage może zostać rozbudowany przy integracji mobile; obecnie jest prywatny lokalny kontrakt i metadata zgodne z MVP.

### Następny krok

- Etapy 12-13: dashboard Start oraz realtime/SSE po zmianach domenowych.

## 2026-04-26 - Etapy 12-13 - dashboard Start i realtime/SSE

### Zakres

- Zaimplementowano backendowy dashboard Start:
  - `GET /api/start/dashboard`,
  - podsumowanie finansów bieżącego miesiąca,
  - najbliższe wydarzenia,
  - bieżący tygodniowy plan jedzenia,
  - podgląd zadań todo.
- Zaimplementowano prywatny kanał realtime przez SSE:
  - `GET /api/realtime/events`,
  - autoryzacja JWT i aktywny kontekst domu,
  - heartbeat `ping`,
  - filtrowanie eventów po `householdId`.
- Podpięto publikację eventów domenowych po mutacjach w modułach:
  - finanse,
  - jedzenie,
  - kalendarz,
  - todo,
  - notatki,
  - zakupy,
  - sprzątanie,
  - koszty roczne,
  - dane,
  - załączniki,
  - dom i uprawnienia.

### Agenci

- Codex główny: `StartModule`, integracja eventów domenowych, smoke i dokumentacja.
- Popper: `RealtimeModule`, `RealtimeService`, `RealtimeController`.

### Pliki

- `apps/api/src/modules/start/start.controller.ts`
- `apps/api/src/modules/start/start.module.ts`
- `apps/api/src/modules/start/start.service.ts`
- `apps/api/src/modules/realtime/realtime.controller.ts`
- `apps/api/src/modules/realtime/realtime.module.ts`
- `apps/api/src/modules/realtime/realtime.service.ts`
- `packages/shared-types/src/index.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/**/**.service.ts` w miejscach publikujących eventy realtime
- `docs/checklista_mvp_i_akceptacji_v2.md`
- `docs/progress.md`

### Decyzje

- Realtime działa jako globalny moduł backendowy, żeby usługi domenowe mogły publikować eventy bez importowania modułu w każdym feature module.
- Eventy są publikowane po mutacjach, a zwykłe odczyty nie wysyłają powiadomień.
- Kanał SSE jest chroniony tym samym JWT i kontekstem aktywnego domu co reszta prywatnego API.
- Checkboxy realtime w checkliście pozostają otwarte do integracji mobile/TanStack Query, bo backend emituje eventy, ale klient jeszcze nie odświeża widoków.

### Testy

- `pnpm.cmd --filter @homeapp/api typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api lint` - OK.
- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd build` - OK.
- `pnpm.cmd test` - OK, 2 pliki testowe API, 8 testów.
- API smoke na lokalnym PostgreSQL - OK:
  - rejestracja, weryfikacja e-mail, logowanie,
  - utworzenie domu,
  - utworzenie danych finansowych dla bieżącego miesiąca,
  - dodanie przyszłego wydarzenia,
  - utworzenie planu jedzenia dla bieżącego tygodnia,
  - utworzenie zadania todo,
  - `GET /api/start/dashboard` zwrócił finanse, wydarzenie, plan jedzenia i todo,
  - dwa równoległe połączenia SSE otrzymały `shopping.changed` po dodaniu pozycji zakupów.
- Serwer smoke na porcie `3014` został zatrzymany po testach.

### Checklist items

- Zaznaczono `najbliższe wydarzenia widać na starcie`.
- Zaznaczono w sekcji Start:
  - `pokazuje podsumowanie finansów`,
  - `pokazuje wydarzenia`,
  - `pokazuje plan jedzenia`.

### Blokery

- Brak blokerów backendowych dla Start i SSE.
- Realtime wymaga jeszcze integracji w mobile, żeby zaznaczyć odświeżanie konkretnych widoków.
- Multi-user realtime warto potwierdzić po domknięciu zaproszeń i dołączania członków do domu.

### Następny krok

- Etap 14+: integracja mobile z API, ekran Start i invalidacja cache po eventach SSE.

## 2026-04-26 - Etap 14-16 - mobile auth, Start i realtime client

### Zakres

- Dodano warstwę API w mobile:
  - konfiguracja `EXPO_PUBLIC_API_URL` z fallbackiem do `http://localhost:3000/api`,
  - `ApiError`,
  - typowane requesty JSON z Bearer tokenem,
  - endpointy auth, utworzenia domu i dashboardu Start.
- Dodano klienta realtime w mobile:
  - subskrypcja SSE/fetch-stream do `/api/realtime/events`,
  - no-op fallback, gdy środowisko nie wspiera streamu,
  - mapowanie eventów domenowych na invalidacje TanStack Query.
- Dodano prostą sesję mobile:
  - logowanie,
  - rejestracja z dev-weryfikacją e-mail,
  - utworzenie pierwszego domu,
  - redirect do aplikacji dopiero po gotowej sesji i domu.
- Przebudowano ekran Start na realne dane z API:
  - finanse,
  - wydarzenia,
  - plan jedzenia,
  - todo.
- Dodano proste komponenty formularzy i przycisku w stylu spójnym z dotychczasowym Minimal UI.
- Uzupełniono `docs/local-development.md` o `EXPO_PUBLIC_API_URL`.

### Agenci

- Codex główny: ekran auth/onboarding, ekran Start, integracja sesji, dokumentacja i checki.
- Galileo: klient API mobile, typy odpowiedzi, query keys, klient SSE i mapowanie invalidacji.

### Pliki

- `apps/mobile/app/index.tsx`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/src/api/**`
- `apps/mobile/src/realtime/**`
- `apps/mobile/src/session/session-context.tsx`
- `apps/mobile/src/ui/action-button.tsx`
- `apps/mobile/src/ui/text-field.tsx`
- `apps/mobile/src/theme/tokens.ts`
- `apps/mobile/.gitignore`
- `apps/mobile/tsconfig.json`
- `apps/mobile/package.json`
- `pnpm-lock.yaml`
- `docs/checklista_mvp_i_akceptacji_v2.md`
- `docs/local-development.md`
- `docs/progress.md`

### Decyzje

- Sesja mobile jest na razie pamięciowa. Trwały storage, PIN/biometria i offline nie wchodzą w MVP.
- Rejestracja w mobile używa `devVerificationToken`, bo produkcyjna wysyłka e-maili nie jest jeszcze konfigurowana.
- Realtime invaliduje query keys dla modułów, ale checkboxy realtime zostają otwarte do momentu podpięcia realnych widoków modułów pod dane.
- Start pozostaje prosty i pokazuje tylko sekcje przewidziane w MVP.
- `react-native` wyrównano do `0.76.9`, czyli wersji oczekiwanej przez zainstalowane Expo SDK.

### Testy

- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `pnpm.cmd --filter @homeapp/mobile build` - OK, Expo export Android/iOS.
- `pnpm.cmd --filter @homeapp/mobile test` - OK, brak testów mobile.
- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd build` - OK.
- `pnpm.cmd test` - OK, backend 2 pliki testowe / 8 testów, mobile bez testów.
- Dev smoke - OK:
  - API healthcheck na `http://localhost:3000/api/health`,
  - Metro/Expo odpowiada na `http://localhost:8081`.

### Checklist items

- Zaznaczono `układ pozostaje prosty` w sekcji Start.

### Blokery

- Brak blokerów kompilacyjnych.
- Do pełnego realtime akceptacyjnego potrzebne są jeszcze realne widoki modułów oraz scenariusz dwóch członków domu.

### Następny krok

- Rozbudować mobile moduły: Finanse, Plan, Zakupy, Dom/Więcej na realnych danych z akcjami MVP i permission guards.

## 2026-04-26 - Backend hardening - błędy, dom, permissions i cykliczność

### Zakres

- Dodano wspólną konfigurację aplikacji API:
  - globalny prefix `api`,
  - globalny `ValidationPipe`,
  - `forbidNonWhitelisted`,
  - spójny globalny filtr błędów.
- Ustandaryzowano odpowiedzi błędów API:
  - `statusCode`,
  - `code`,
  - `message`,
  - `details`,
  - `path`,
  - `timestamp`.
- Błędy PostgreSQL są mapowane na kody HTTP:
  - unique violation -> `409 CONFLICT`,
  - invalid reference/check/null/date -> `400`.
- Domknięto flow zaproszeń:
  - owner tworzy zaproszenie,
  - aktywny duplikat zaproszenia zwraca `409`,
  - zalogowany użytkownik akceptuje token przez `POST /api/invitations/accept`,
  - e-mail użytkownika musi pasować do zaproszenia,
  - użytkownik nie może mieć już aktywnego domu,
  - po dołączeniu dostaje membership i dochód `0` w bieżącym miesiącu,
  - konto `inactive` przechodzi na `active`.
- Dodano `GET /api/households/me/permissions`:
  - owner widzi pełne uprawnienia,
  - member widzi efektywne flagi per moduł,
  - endpoint umożliwia mobile ukrywanie modułów bez `read`.
- Utwardzono auth:
  - login lokalny wymaga zweryfikowanego e-maila,
  - `banned` blokuje login,
  - `banned` blokuje refresh i czyści pozostałe refresh tokeny użytkownika.
- Dodano ekspansję cyklicznych wydarzeń kalendarza:
  - format `FREQ=DAILY|WEEKLY|MONTHLY;INTERVAL=n;UNTIL=YYYY-MM-DD;COUNT=n`,
  - walidacja reguły przy create/update,
  - ekspansja w `GET /api/calendar/events`,
  - ekspansja w `GET /api/calendar/upcoming`,
  - Start korzysta z `CalendarService`, więc widzi też wydarzenia cykliczne.
- Dodano testy automatyczne dla błędów API i polityk auth.

### Pliki

- `apps/api/src/shared/http/api-exception.filter.ts`
- `apps/api/src/shared/http/api-exception.filter.spec.ts`
- `apps/api/src/shared/http/configure-app.ts`
- `apps/api/src/shared/http/validation-exception.factory.ts`
- `apps/api/src/main.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.service.spec.ts`
- `apps/api/src/modules/invitations/**`
- `apps/api/src/modules/households/households.controller.ts`
- `apps/api/src/modules/households/households.service.ts`
- `apps/api/src/modules/permissions/permissions.service.ts`
- `apps/api/src/modules/calendar/calendar.service.ts`
- `apps/api/src/modules/start/start.module.ts`
- `apps/api/src/modules/start/start.service.ts`
- `docs/checklista_mvp_i_akceptacji_v2.md`
- `docs/progress.md`

### Decyzje

- Nie dodano Google OAuth, bo wcześniej ustaliliśmy, że Google robimy na końcu.
- `GET /api/households/me/permissions` nie wymaga permission guard, bo służy do ustalenia własnej widoczności modułów.
- Nowy członek po akceptacji zaproszenia startuje bez jawnych uprawnień; owner nadaje je osobno.
- Cykliczność kalendarza obsługuje prosty, przewidywalny subset RRULE potrzebny do MVP.

### Testy

- `pnpm.cmd --filter @homeapp/api typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api lint` - OK.
- `pnpm.cmd --filter @homeapp/api test` - OK, 3 pliki testowe, 14 testów.
- `pnpm.cmd --filter @homeapp/api db:migrate` na lokalnym PostgreSQL - OK.
- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd test` - OK.
- `pnpm.cmd build` - OK.
- Backend hardening smoke na lokalnym PostgreSQL - OK:
  - standardowy `400 VALIDATION_ERROR`,
  - duplicate e-mail -> `409 CONFLICT`,
  - login przed weryfikacją e-mail -> `403`,
  - owner ma pełne permissions,
  - zaproszenie, duplikat zaproszenia i akceptacja,
  - nowy member ma domyślnie brak read/create/update/delete,
  - read-only member może czytać zakupy, ale nie może tworzyć pozycji,
  - dane są wspólne dla domu,
  - cykliczne wydarzenie tygodniowe rozwija się do 3 wystąpień,
  - Start pokazuje wydarzenie cykliczne,
  - usunięty member natychmiast traci dostęp,
  - `banned` blokuje login.

### Checklist items

- Zaznaczono zaproszenie członka, dołączenie, usunięcie przez ownera, natychmiastową utratę dostępu i banned login.
- Zaznaczono read-only oraz backendowe egzekwowanie create/update/delete.
- Zaznaczono cykliczność kalendarza.
- Zaznaczono wspólną listę danych dla domu.

### Blokery

- Google OAuth nadal celowo zostaje na koniec.
- Ukrywanie modułów bez `read` ma backendowy kontrakt, ale finalny checkbox UI zostaje otwarty do implementacji permission guards w mobile.

### Następny krok

- Podpiąć mobile do `GET /api/households/me/permissions` i ukrywać moduły bez `read`; potem budować realne ekrany modułów na gotowym backendzie.

## 2026-04-26 - Mobile permissions, Zakupy i APK debug

### Zakres

- Podpieto mobile pod `GET /api/households/me/permissions`.
- Zakladki w mobile ukrywaja moduly bez efektywnego `canRead`.
- Zbudowano realny ekran `Zakupy`: dwie listy, dodawanie pozycji z iloscia, checkbox, usuwanie i wyszarzanie zaznaczonych.
- Ekran `Zakupy` respektuje `canRead`, `canCreate`, `canUpdate` i `canDelete`.
- Wygenerowano natywny projekt Android przez Expo prebuild.
- Wygenerowano debug APK i skopiowano go do `builds/homeapp-debug.apk`.

### Pliki

- `apps/mobile/src/api/types.ts`
- `apps/mobile/src/api/endpoints.ts`
- `apps/mobile/src/permissions/use-permissions.ts`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/zakupy.tsx`
- `apps/mobile/app.json`
- `apps/mobile/index.js`
- `apps/mobile/metro.config.js`
- `apps/mobile/react-native.config.js`
- `apps/mobile/scripts/expo-cli-wrapper.js`
- `apps/mobile/android/**`
- `apps/mobile/package.json`
- `pnpm-lock.yaml`
- `packages/eslint-config/base.mjs`
- `builds/homeapp-debug.apk`
- `docs/checklista_mvp_i_akceptacji_v2.md`
- `docs/progress.md`

### Decyzje

- Google OAuth nadal zostaje na koniec.
- APK w `builds/homeapp-debug.apk` jest debug APK do lokalnego sprawdzania.
- Release APK bundluje JS poprawnie, ale natywna kompilacja `react-native-reanimated` na tej dlugiej sciezce Windows zatrzymuje sie na limicie sciezek CMake/Ninja. Do produkcyjnego release trzeba budowac z krotszej sciezki albo wlaczyc long paths w Windows.
- Dodano wrapper Expo CLI dla Android/Gradle, bo pnpm + Expo Router + Windows relatywizowaly entrypoint release do zlego rootu.

### Testy

- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `pnpm.cmd --filter @homeapp/mobile build` - OK, Expo export Android/iOS.
- `pnpm.cmd --filter @homeapp/mobile exec expo prebuild --platform android --no-install` - OK.
- `.\gradlew.bat assembleDebug --max-workers=1` - OK przy pierwszym buildzie debug APK; plik skopiowany do `builds/homeapp-debug.apk`.
- `.\gradlew.bat assembleRelease --max-workers=1` - BLOKUJE lokalny limit dlugich sciezek Windows w CMake/Ninja dla `react-native-reanimated`.

### Checklist items

- Zaznaczono `moduly moga byc ukryte przez brak read`.
- Zaznaczono `zaznaczone sa wyszarzone` w Zakupach.

### Blokery

- Standalone release APK wymaga krotszej sciezki projektu albo wlaczonego Windows long paths.
- Pelne realtime multi-user nadal wymaga testu z dwoma uzytkownikami i realnymi ekranami pozostalych modulow.

### Nastepny krok

- Budowac kolejne realne ekrany mobile: Finanse, Plan, Dom/Wiecej oraz osobne widoki todo/notatki.

## 2026-04-26 - Skrypty startowe dev

### Zakres

- Dodano proste skrypty PowerShell do uruchamiania API i Metro mobile.
- Uzupelniono dokumentacje lokalnego startu serwera i aplikacji mobilnej.
- Dodano wrappery `.cmd`, zeby ominac blokade PowerShell Execution Policy.
- Backend slucha jawnie na `HOST=0.0.0.0`, co pozwala laczyc sie z Androida przez Wi-Fi.
- Dodano LAN health check oraz pomocniczy skrypt do otwarcia portow `3000` i `8081` w Windows Firewall.

### Pliki

- `scripts/start-api-dev.ps1`
- `scripts/start-api-dev.cmd`
- `scripts/start-mobile-dev.ps1`
- `scripts/start-mobile-dev.cmd`
- `scripts/check-lan-dev.ps1`
- `scripts/check-lan-dev.cmd`
- `scripts/open-firewall-dev.cmd`
- `apps/api/src/main.ts`
- `apps/api/src/shared/env.ts`
- `apps/api/.env.example`
- `docs/local-development.md`
- `docs/progress.md`

### Testy

- API health smoke: `GET /api/health` - OK.
- Metro Expo nasluchuje na porcie `8081` - OK.
- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `pnpm.cmd --filter @homeapp/api test` - OK, 14 testow.

### Nastepny krok

- Kontynuowac realne ekrany mobile na gotowym API.

## 2026-04-27 - LAN test Android bez kabla

### Zakres

- Przygotowano tryb testow na fizycznym Androidzie bez kabla USB.
- API uruchamia sie z `HOST=0.0.0.0`, wiec jest dostepne w sieci lokalnej.
- Dodano `.cmd` wrappery dla skryptow dev, zeby nie blokowala ich PowerShell Execution Policy.
- Dodano `check-lan-dev` pokazujacy IP, URL API dla Androida, status portow i health endpoint.
- Dodano `open-firewall-dev.cmd` do jednorazowego otwarcia portow `3000` i `8081` w Windows Firewall.

### Pliki

- `apps/api/src/main.ts`
- `apps/api/src/shared/env.ts`
- `apps/api/.env.example`
- `scripts/start-api-dev.cmd`
- `scripts/start-mobile-dev.cmd`
- `scripts/check-lan-dev.ps1`
- `scripts/check-lan-dev.cmd`
- `scripts/open-firewall-dev.cmd`
- `docs/local-development.md`
- `docs/progress.md`

### Testy

- `pnpm.cmd --filter @homeapp/api typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api lint` - OK.
- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api test` - OK, 14 testow.
- `scripts/check-lan-dev.cmd` - OK dla `192.168.100.109`.
- Windows Wi-Fi ma profil `Public`, dlatego firewall script otwiera porty dla `profile=any`.

### Decyzje

- Do testow bez kabla uzywamy tej samej sieci Wi-Fi, adresu `http://192.168.100.109:3000/api` i Metro na `192.168.100.109:8081`.
- APK debug nadal wymaga uruchomionego Metro; release standalone zostaje osobnym krokiem po rozwiazaniu limitu dlugich sciezek Windows.

### Nastepny krok

- Po potwierdzeniu testow na telefonie kontynuowac realne ekrany mobile.

## 2026-04-27 - Realne ekrany mobile i aktualny APK

### Zakres

- Dodano brakujace typy i wrappery API w mobile dla finansow, planu, kalendarza, todo, notatek, sprzatania, kosztow rocznych, danych, zalacznikow, domu, czlonkow i uprawnien.
- Ekran `Finanse` pokazuje biezacy miesiac, podsumowanie, dochody, kategorie, pozycje budzetowe, dodawanie wydatkow, archiwum i generowanie kolejnego miesiaca.
- Ekran `Plan` ma osobne segmenty: Jedzenie, Kalendarz, Zadania, Notatki.
- Ekran `Dom` ma segmenty: Sprzatanie, Koszty, Dane, Pliki.
- Ekran `Wiecej` pokazuje dom, czlonkow, zapraszanie, usuwanie czlonkow, wlasne uprawnienia i sekcje techniczna.
- Dodano `docs/qa-mobile-notes.md`.
- Ustabilizowano Metro przez blockliste natywnych katalogow buildowych.
- Przygotowano skrypt `scripts/build-mobile-debug-apk.cmd`, ktory buduje APK z krotkiej kopii `C:\ha`.
- Wygenerowano aktualny debug APK:
  - `builds/homeapp-debug.apk`
  - `builds/homeapp-debug-20260427-2020.apk`

### Pliki

- `apps/mobile/src/api/types.ts`
- `apps/mobile/src/api/endpoints.ts`
- `apps/mobile/src/utils/format.ts`
- `apps/mobile/app/(tabs)/finanse.tsx`
- `apps/mobile/app/(tabs)/plan.tsx`
- `apps/mobile/app/(tabs)/dom.tsx`
- `apps/mobile/app/(tabs)/wiecej.tsx`
- `apps/mobile/metro.config.js`
- `apps/mobile/app.json`
- `apps/mobile/android/gradle.properties`
- `scripts/build-mobile-debug-apk.ps1`
- `scripts/build-mobile-debug-apk.cmd`
- `docs/qa-mobile-notes.md`
- `docs/local-development.md`
- `docs/progress.md`
- `docs/checklista_mvp_i_akceptacji_v2.md`

### Testy

- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `pnpm.cmd --filter @homeapp/mobile build` - OK, Expo export Android/iOS.
- `pnpm.cmd --filter @homeapp/api typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api lint` - OK.
- `pnpm.cmd --filter @homeapp/api test` - OK, 14 testow.
- `C:\ha\apps\mobile\android\gradlew.bat clean assembleDebug --max-workers=1` - OK.
- `scripts/check-lan-dev.cmd` - OK: API `192.168.100.109:3000`, Metro `192.168.100.109:8081`.

### Checklist items

- Zaznaczono `zadania i notatki sa w osobnych zakladkach`.

### Decyzje

- Dla lokalnego debug APK `newArchEnabled=false`, bo dluga sciezka repo + pnpm powodowala bledy CMake/Ninja na Windows.
- APK debug nadal testujemy z Metro uruchomionym po LAN.

### Nastepny krok

- Smoke test na Androidzie przez Wi-Fi i poprawki UX/bugs z realnego klikania.
- Nastepnie test realtime dwoma uzytkownikami i domykanie checkboxow realtime.

## 2026-04-27 - Standalone release APK po czarnym ekranie debug APK

### Zakres

- Zdiagnozowano czarny ekran jako prawdopodobny efekt uruchomienia debug APK bez skutecznego polaczenia z Metro.
- Przygotowano release APK z wbudowanym JS bundlem, zeby telefon nie wymagal Metro ani kabla.
- Wlaczono cleartext HTTP w main Android manifest dla lokalnego backendu po LAN.
- Poprawiono odczyt `EXPO_PUBLIC_API_URL` w mobile tak, aby Expo moglo wstrzyknac adres API do release bundla.
- Uproszczono `metro.config.js`, zeby blocklista dzialala rowniez podczas `export:embed`.
- Dodano `scripts/build-mobile-release-apk.cmd` i `scripts/build-mobile-release-apk.ps1`.
- Skrypt release buduje z `C:\hr` oraz hoisted `node_modules`, bo release CMake/Ninja na Windows wpada w limit 260 znakow przy standardowym pnpm layout.
- Wygenerowano standalone APK:
  - `builds/homeapp-release.apk`
  - `builds/homeapp-release-20260427-2055.apk`

### Pliki

- `apps/mobile/src/api/config.ts`
- `apps/mobile/metro.config.js`
- `apps/mobile/android/app/src/main/AndroidManifest.xml`
- `scripts/build-mobile-release-apk.ps1`
- `scripts/build-mobile-release-apk.cmd`
- `docs/local-development.md`
- `docs/progress.md`

### Testy

- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK w kopii `C:\hr`.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK w kopii `C:\hr`.
- `C:\hr\apps\mobile\android\gradlew.bat clean assembleRelease --max-workers=1` - OK.
- `scripts/check-lan-dev.cmd` - OK: API `192.168.100.109:3000`, Metro `192.168.100.109:8081`, health po LAN OK.
- `rg` w release bundle potwierdzil obecnosc `192.168.100.109`.

### Decyzje

- Do testow na telefonie bez kabla priorytetowo uzywamy `builds/homeapp-release.apk`.
- `builds/homeapp-debug.apk` zostaje do debugowania z Metro po LAN.

### Nastepny krok

- Uzytkownik instaluje `homeapp-release.apk` i testuje logowanie/rejestracje z wlaczonym API.
- Po potwierdzeniu startu UI kontynuowac smoke testy modulow mobile i poprawki UX.

## 2026-04-27 - Poprawka splash/boot release APK

### Zakres

- Po raporcie, ze aplikacja stoi na splash screenie, dodano jawne `SplashScreen.hideAsync()` po zamontowaniu root layoutu.
- Dodano root error boundary, ktory pokazuje komunikat bledu na ekranie zamiast zostawiac telefon na wiecznym splashu.
- Przeniesiono konfiguracje API z runtime `process.env` do `expo-constants` przez `apps/mobile/app.config.js`.
- `src/api/config.ts` czyta teraz `Constants.expoConfig.extra.apiUrl`, a `EXPO_PUBLIC_API_URL` jest zapisywany do configu podczas builda.
- Poprawiono skrypt release APK: domyslnie uzywa swiezego krotkiego katalogu roboczego, bo ponowne kasowanie starych `node_modules` na Windows potrafilo wpasc w limit dlugosci sciezki.
- Wygenerowano nowy release APK:
  - `builds/homeapp-release.apk`
  - `builds/homeapp-release-20260427-2324.apk`

### Pliki

- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app.config.js`
- `apps/mobile/src/api/config.ts`
- `scripts/build-mobile-release-apk.ps1`
- `docs/local-development.md`
- `docs/progress.md`

### Testy

- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `C:\h3\apps\mobile\android\gradlew.bat clean assembleRelease --max-workers=1` - OK.
- `scripts/check-lan-dev.cmd` - OK: API health po LAN OK.
- `pnpm.cmd --filter @homeapp/api test` - OK, 14 testow.
- Release bundle zawiera tekst error fallback i adres `http://192.168.100.109:3000/api`.

### Decyzje

- Do kolejnego testu instalowac najnowszy `builds/homeapp-release.apk` po odinstalowaniu poprzedniej wersji z telefonu.
- Jesli nadal pojawi sie splash albo ekran bledu, kolejnym krokiem jest zebranie `adb logcat` z telefonu przez USB.

## 2026-04-28 - Release APK bez natywnego splash screena

### Zakres

- Przeanalizowano `logcat-homeapp.txt` po raporcie, ze aplikacja nadal stoi na logo.
- Logcat nie pokazal fatalnego bledu `ReactNativeJS` ani `AndroidRuntime`; widoczne byly natywne problemy startu Activity, m.in. `no window has focus`, `exp_actresumetimeoutcom.homeapp.mobile` oraz `NO_INPUT_CHANNEL`.
- Wykluczono problem LAN/API na podstawie dzialajacego `/api/health` i testu `scripts/check-lan-dev.cmd`.
- Usunieto natywna instalacje Expo SplashScreen z `MainActivity.kt`, zeby Android nie mogl przykryc React UI wiecznym splash screenem.
- Przestawiono `MainActivity` w manifeście z `@style/Theme.App.SplashScreen` bezposrednio na `@style/AppTheme`.
- Przywrocono pelny root layout i ekran startowy aplikacji z backupu diagnostycznego.
- Usunieto pliki `app/_layout.bak.tsx` i `app/index.bak.tsx`, bo Expo Router mogl traktowac je jako trasy.
- Uproszczono `apps/mobile/index.js` do oficjalnego `expo-router/entry`.
- Podbito Android `versionCode` do `2` i `versionName` do `0.1.1`, aby telefon przyjal nowy build jako nowsza wersje.
- Wygenerowano nowy standalone release APK:
  - `builds/homeapp-release.apk`
  - `builds/homeapp-release-20260428-0651.apk`

### Pliki

- `apps/mobile/android/app/src/main/java/com/homeapp/mobile/MainActivity.kt`
- `apps/mobile/android/app/src/main/AndroidManifest.xml`
- `apps/mobile/android/app/build.gradle`
- `apps/mobile/app.json`
- `apps/mobile/index.js`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/index.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `docs/progress.md`
- `docs/local-development.md`
- `docs/qa-mobile-notes.md`

### Testy

- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `scripts/build-mobile-release-apk.cmd -ApiUrl 'http://192.168.100.109:3000/api'` - OK; ostatni build `20260430-0751`.
- Build wykonany ze swiezego katalogu roboczego `C:\h-apk-0428-064143`.
- `scripts/check-lan-dev.cmd` - OK dla API `192.168.100.109:3000`; Metro nie jest wymagane dla release APK.
- Sprawdzono metadane Gradle output: `versionCode=2`, `versionName=0.1.1`.
- Release bundle zawiera adres `http://192.168.100.109:3000/api` oraz teksty fallback/error UI.

### Checklist items

- Brak nowych checkboxow MVP do zamkniecia. Ta zmiana jest poprawka uruchamiania APK i musi zostac potwierdzona instalacja na realnym telefonie.

### Decyzje

- Historycznie: wtedy do testu wskazany byl APK z `20260428-0651`. Aktualny APK opisuje wpis z 2026-04-30.
- Przed instalacja najlepiej odinstalowac poprzednia aplikacje `HomeApp` z telefonu, zeby Android nie zostawil starego stanu startowego.
- Release APK nie wymaga Metro; wymagane jest tylko dzialajace API po LAN.

### Nastepny krok

- Uzytkownik instaluje najnowszy release APK i sprawdza, czy po splashu widac ekran logowania albo ekran bledu aplikacji.
- Jesli telefon nadal zatrzyma sie na logo, kolejnym artefaktem diagnostycznym powinien byc nowy `adb logcat` z cold startu najnowszej wersji `versionCode=2`.

## 2026-04-29 - Aktywny folder Desktop, P0 mobile i Metro na telefonie

### Zakres

- Ustalono, ze byly dwie kopie projektu: `C:\homeapp` oraz aktywny folder IDE `C:\Users\moski\Desktop\homeapp`.
- Port `8081` byl zajety przez Metro ze starej sciezki `C:\homeapp`, dlatego telefon mogl pobierac bundle z niewlasciwej kopii.
- Zatrzymano stare Metro i uruchomiono Metro z aktywnego folderu `C:\Users\moski\Desktop\homeapp`.
- Przeniesiono stabilny zestaw ekranow mobile i komponentow UI do aktywnej kopii.
- Naprawiono P0 build mobile w aktywnej kopii:
  - brakujace eksporty `src/ui/index.ts`,
  - urwane importy ikon w ekranach tabow,
  - blad skladni w `zakupy.tsx`,
  - brak root `index.js`, ktory byl wymagany przez zainstalowany debug build.
- Poprawiono widoczne teksty: `Wejdz` -> `Wejdz` z polskim znakiem w UI, `Wiecej` -> `Wiecej` z polskim znakiem w tabie oraz komunikat pobierania danych.
- Potwierdzono uruchomienie aplikacji na telefonie przez Metro/ADB z aktywnego folderu.

### Pliki

- `index.js`
- `apps/mobile/app/index.tsx`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/(tabs)/finanse.tsx`
- `apps/mobile/app/(tabs)/plan.tsx`
- `apps/mobile/app/(tabs)/zakupy.tsx`
- `apps/mobile/app/(tabs)/dom.tsx`
- `apps/mobile/app/(tabs)/wiecej.tsx`
- `apps/mobile/src/api/endpoints.ts`
- `apps/mobile/src/theme/tokens.ts`
- `apps/mobile/src/ui/*`
- `docs/progress.md`
- `docs/qa-mobile-notes.md`

### Testy

- `pnpm.cmd install` - OK.
- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK w aktywnym folderze Desktop.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK w aktywnym folderze Desktop.
- Metro uruchomione z aktywnego folderu: `C:\Users\moski\Desktop\homeapp\apps\mobile`.
- ADB reverse:
  - `tcp:8081 -> tcp:8081`
  - `tcp:3000 -> tcp:3000`
- Cold start telefonu po USB - OK, ekran logowania widoczny.
- Artefakty:
  - `adb-desktop-active-3.png` - ekran logowania z aktywnego folderu.
  - `adb-desktop-active-3.log` - brak `Invariant Violation`, `ReferenceError`, `TypeError`, `Query data cannot be undefined`.

### Decyzje

- Od teraz aktywnym zrodlem prawdy jest `C:\Users\moski\Desktop\homeapp`.
- Przy pracy z telefonem debugujemy przez Metro i USB, bez budowania nowego APK po kazdej malej zmianie.
- Jesli debug app pokazuje `Unable to resolve module ./index`, sprawdzic root `index.js`.
- MIUI blokuje zdalne `adb shell input tap` przez `INJECT_EVENTS`, wiec interakcje formularzy trzeba wykonywac recznie na telefonie albo wlaczyc dodatkowe debugowanie bezpieczenstwa w opcjach programisty.

### Checklist items

- Brak nowych checkboxow MVP zamknietych. To byl etap stabilizacji uruchamiania i synchronizacji aktywnej kopii.

### Nastepny krok

- Uzytkownik recznie testuje rejestracje/logowanie na telefonie przy dzialajacym API.
- Po potwierdzeniu wejscia do aplikacji robimy smoke test Start/Finanse/Plan/Zakupy/Dom/Wiecej i zamykamy checklisty tylko po realnym przejsciu przeplywow.

## 2026-04-30 - Przebudowa UX mobile, auth i theme foundation

### Zakres

- Potwierdzono, ze aktywnym repo pozostaje `C:\Users\moski\Desktop\homeapp`.
- Stara kopia `C:\homeapp` zostala oprozniona; pusty katalog nadal jest blokowany przez proces Windows, ale nie zawiera juz plikow projektu.
- Dodano fundament jasnego i ciemnego motywu przez `useAppTheme` oraz przepieto wspolne komponenty UI na dynamiczna palete.
- Rozbudowano ekran auth o elementy wymagane przed produkcyjnym testem:
  - wycentrowany brand/logo,
  - reset hasla,
  - oko podgladu hasla,
  - pasek sily hasla,
  - checkbox zapamietania sesji,
  - przyciski Google/Apple jako przygotowane wejscia OAuth,
  - akceptacje regulaminu i polityki prywatnosci z modalnym podgladem.
- Dodano `expo-secure-store` i bezpieczny magazyn sesji/e-maila dla `Zapamietaj mnie`.
- Przebudowano Start na bardziej operacyjny dashboard z hero i kolorowymi akcentami.
- Przebudowano Zakupy w kierunku szybkiej listy typu Listonic: segmenty, szybki composer, grupy `Do kupienia` / `Kupione`.
- Przebudowano Finanse w kierunku dashboardu: saldo miesiaca, pasek wykorzystania budzetu, metryki z osobnymi akcentami.
- Przebudowano Plan, Dom i Wiecej na dynamiczny motyw oraz czytelniejsze sekcje z akcentami modulow.
- Utworzono brakujacy dokument `docs/widoki-mobile-podstawowe.md` w aktywnym repo.
- Zbudowano nowy release APK po dodaniu natywnego `expo-secure-store`.

### Pliki

- `apps/mobile/app.json`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/index.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/(tabs)/finanse.tsx`
- `apps/mobile/app/(tabs)/plan.tsx`
- `apps/mobile/app/(tabs)/zakupy.tsx`
- `apps/mobile/app/(tabs)/dom.tsx`
- `apps/mobile/app/(tabs)/wiecej.tsx`
- `apps/mobile/src/session/session-context.tsx`
- `apps/mobile/src/session/secure-session-store.ts`
- `apps/mobile/src/theme/use-app-theme.ts`
- `apps/mobile/src/ui/*`
- `docs/widoki-mobile-podstawowe.md`
- `docs/progress.md`

### Testy

- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `pnpm.cmd --filter @homeapp/mobile test` - OK, brak testow mobilnych.
- `pnpm.cmd --filter @homeapp/api typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api test` - OK, 14 testow przeszlo.
- `pnpm.cmd --filter @homeapp/mobile exec expo config --type public` - OK, `userInterfaceStyle=automatic`, plugin `expo-secure-store`.
- `scripts/build-mobile-release-apk.cmd -ApiUrl 'http://192.168.100.109:3000/api'` - OK.
- API health lokalnie: `http://localhost:3000/api/health` - OK.
- ADB: brak podlaczonego urzadzenia w momencie testu, wiec nie wykonano aktualnego screenshotu po zmianach.

### Artefakty

- `builds/homeapp-release.apk`
- `builds/homeapp-release-20260430-0751.apk`
- API wbudowane w release APK: `http://192.168.100.109:3000/api`.
- Android `versionCode=2`, `versionName=0.1.1`.

### Checklist items

- Nie zamknieto nowych checkboxow MVP. Zmiany UI musza byc jeszcze potwierdzone smoke testem na telefonie i realnym flow rejestracji/logowania.

### Decyzje

- Google/Apple pozostaja widoczne w UI, ale pelny OAuth nadal wymaga konfiguracji providerow.
- `expo-secure-store` wymaga przebudowy dev/release builda, aby natywny modul byl dostepny na telefonie.
- Dalsza przebudowa frontend idzie modulami: Plan, Dom, Wiecej oraz kolejne smoke testy na telefonie.

### Nastepny krok

- Dokończyć Plan/Dom/Wiecej w tym samym kierunku UX i motywu.
- Po podlaczeniu telefonu uruchomic Metro z aktywnego repo, ustawic ADB reverse i zrobic screenshoty auth/Start/Finanse/Zakupy.

## 2026-04-30 - Produkcyjne utwardzenie auth, sesji i realtime

### Zakres

- Oceniono projekt jako niegotowy produkcyjnie; najwieksze braki to OAuth, produkcyjne sekrety/env, e-mail tokeny, odswiezanie sesji i potwierdzone realtime multi-user.
- Dodano backendowy fundament Google OAuth:
  - dependency `google-auth-library`,
  - `GOOGLE_OAUTH_CLIENT_ID` w env,
  - weryfikacja Google ID tokena,
  - upsert uzytkownika Google przez `google_subject`,
  - blokada logowania dla kont `banned`.
- Dodano migracje `202604300001_google_oauth.sql` i zastosowano ja na lokalnej bazie `homeapp_dev`.
- Produkcja nie uruchomi sie na domyslnych sekretach JWT, localhostowym publicznym URL ani domyslnym `DATABASE_URL`.
- Backend nie zwraca juz `devVerificationToken` i `devResetToken` w `NODE_ENV=production`.
- Mobile przechowuje daty wygasania access/refresh tokenow i odswieza access token przed wygasnieciem.
- Mobile odswieza zapamietana sesje po starcie, jesli access token wygasl, ale refresh token nadal jest wazny.
- SSE realtime dostalo automatyczny reconnect z backoffem.
- Zbudowano nowy release APK po zmianach sesji/realtime.

### Pliki

- `apps/api/package.json`
- `pnpm-lock.yaml`
- `apps/api/.env.example`
- `apps/api/src/shared/env.ts`
- `apps/api/src/shared/env.spec.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.service.spec.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/mobile/src/api/endpoints.ts`
- `apps/mobile/src/api/types.ts`
- `apps/mobile/src/session/session-context.tsx`
- `apps/mobile/src/session/secure-session-store.ts`
- `apps/mobile/src/realtime/sse.ts`
- `db/migrations/202604300001_google_oauth.sql`
- `docs/progress.md`

### Testy

- `pnpm.cmd --filter @homeapp/api typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api lint` - OK.
- `pnpm.cmd --filter @homeapp/api test` - OK, 19 testow.
- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `pnpm.cmd --filter @homeapp/mobile test` - OK, brak testow mobile.
- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd test` - OK.
- `pnpm.cmd build` - OK.
- `pnpm.cmd --filter @homeapp/api db:migrate` - OK, applied `202604300001_google_oauth.sql`.
- `scripts/build-mobile-release-apk.cmd -ApiUrl 'http://192.168.100.109:3000/api'` - OK.

### Artefakty

- `builds/homeapp-release.apk`
- `builds/homeapp-release-20260430-1750.apk` (poprzedni artefakt tego etapu; nowszy build jest opisany w kolejnym wpisie)
- API wbudowane w release APK: `http://192.168.100.109:3000/api`.

### Checklist items

- Nie zamknieto Google OAuth, bo backend jest przygotowany, ale brakuje realnej konfiguracji Google klienta i smoke testu na telefonie.
- Nie zamknieto realtime, bo reconnect jest dodany, ale nadal brakuje testu dwoma uzytkownikami/urzadzeniami.

### Nastepny krok

- Podac realne client ID Google dla backendu i mobile, potem przejsc Google login end-to-end.
- Przejsc smoke test na fizycznym telefonie najnowszym APK.
- Zrobic test realtime dwoma sesjami.

## 2026-04-30 - E-mail auth, deep linki i rate limit

### Zakres

- Dodano produkcyjna wysylke e-mail dla weryfikacji konta i resetu hasla:
  - `MAIL_DRIVER=console|smtp`,
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`,
  - w produkcji backend wymaga `MAIL_DRIVER=smtp`, `SMTP_HOST` i jawnego `SMTP_FROM`.
- Linki auth ida przez `AUTH_LINK_BASE_URL`, domyslnie `homeapp://auth`, aby mobile moglo obsluzyc verify/reset jako deep link.
- Dodano `POST /auth/resend-verification`; odpowiedz nie ujawnia czy konto istnieje, a dev token wraca tylko poza produkcja.
- Mobile obsluguje linki:
  - `homeapp://auth/verify-email?email=...&token=...`,
  - `homeapp://auth/reset-password?token=...`.
- Rejestracja w produkcyjnym flow nie udaje automatycznego wejscia do aplikacji: pokazuje komunikat o weryfikacji e-maila i daje akcje ponownego wyslania linku.
- Dodano prosty rate limit na kontroler auth przez `AUTH_RATE_LIMIT_MAX` i `AUTH_RATE_LIMIT_WINDOW_SECONDS`.
- Android release build potrafi uzyc produkcyjnego keystore przez `HOMEAPP_ANDROID_KEYSTORE_PATH`, `HOMEAPP_ANDROID_KEYSTORE_PASSWORD`, `HOMEAPP_ANDROID_KEY_ALIAS`, `HOMEAPP_ANDROID_KEY_PASSWORD`; bez tych env zostaje debugowy podpis do lokalnych testow.
- Posprzatano tymczasowe bundle `apps/mobile/tmp-*` i dodano je do `.gitignore`.
- Zbudowano nowy release APK po zmianach auth/deep link.

### Pliki

- `.gitignore`
- `apps/api/.env.example`
- `apps/api/package.json`
- `pnpm-lock.yaml`
- `apps/api/src/shared/env.ts`
- `apps/api/src/shared/env.spec.ts`
- `apps/api/src/shared/http/api-exception.filter.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.service.spec.ts`
- `apps/api/src/modules/auth/dto/auth.dto.ts`
- `apps/api/src/modules/auth/guards/auth-rate-limit.guard.ts`
- `apps/api/src/modules/mail/mail.module.ts`
- `apps/api/src/modules/mail/mail.service.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/mobile/android/app/build.gradle`
- `apps/mobile/app/index.tsx`
- `apps/mobile/src/api/endpoints.ts`
- `apps/mobile/src/api/types.ts`

### Testy

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

### Artefakty

- `builds/homeapp-release.apk`
- `builds/homeapp-release-20260430-1838.apk`
- API wbudowane w release APK: `http://192.168.100.109:3000/api`.

### Checklist items

- Nie zamykam produkcyjnego auth w checklistcie, bo brakuje realnego SMTP smoke testu oraz testu deep linkow na telefonie.
- Nie zamykam Google OAuth, bo mobile i backend sa spiete kodowo, ale brakuje prawdziwych client ID i testu end-to-end.

### Nastepny krok

- Uruchomic API ponownie, aby wczytalo nowe env i kod.
- Przetestowac na telefonie: rejestracja, verify link, resend verify, reset link, login po odswiezeniu sesji.
- Po realnym SMTP smoke tescie uzupelnic checklistte auth.

## 2026-04-30 - Przygotowanie ADB smoke/debug na telefonie

### Zakres

- Zrestartowano backend z aktualnego repo i aktualnym kodem:
  - stary proces API dzialal od 2026-04-27,
  - nowy proces `node` slucha na `0.0.0.0:3000`,
  - `GET /api/health` zwraca `status=ok`.
- Dodano skrypt automatycznego debug smoke dla Androida:
  - instaluje `builds/homeapp-release.apk`,
  - opcjonalnie czysci dane aplikacji,
  - uruchamia `com.homeapp.mobile`,
  - zapisuje screenshot,
  - zapisuje UI dump,
  - zapisuje logcat.
- Windows widzi podlaczony telefon jako `HUAWEI P30 Pro`, ale `adb devices` nie pokazuje urzadzenia.

### Pliki

- `scripts/android-debug-smoke.ps1`
- `scripts/android-debug-smoke.cmd`
- `docs/progress.md`

### Testy

- `Invoke-RestMethod http://localhost:3000/api/health` - OK.
- `adb devices -l` - brak urzadzenia.
- `scripts/android-debug-smoke.cmd` - zablokowane na `No ADB device found`.

### Bloker

- Telefon jest widoczny dla Windows jako MTP/WPD, ale nie jako ADB. Trzeba na telefonie wlaczyc `Opcje programistyczne`, `Debugowanie USB` i zaakceptowac prompt RSA/debugowania USB. Na Huawei moze byc tez potrzebne wlaczenie `Zezwalaj na debugowanie ADB tylko podczas ladowania` / `Allow ADB debugging in charge only mode` albo zmiana trybu USB.

### Nastepny krok

- Po pojawieniu sie telefonu w `adb devices` jako `device` uruchomic:
  `scripts/android-debug-smoke.cmd -AllowUninstallOnSignatureMismatch`.

## 2026-04-30 - Naprawa reklamacyjna release APK na fizycznym telefonie

### Zakres

- Odtworzono blad release APK na Huawei P30 Pro przez ADB.
- Przeanalizowano kolejne logcaty:
  - `Invariant Violation: "main" has not been registered`,
  - po jawnym AppRegistry: `Cannot read property 'useRef' of null`.
- Potwierdzono w sourcemapie, ze Metro pakowal zdublowane moduly React Native z dwoch lokalizacji w monorepo.
- Utwardzono konfiguracje Metro dla mobile:
  - singletony dla `react`, `react-native`, `expo-router`, `react-native-screens`, `react-native-safe-area-context` i pokrewnych modulow,
  - `resolver.disableHierarchicalLookup = true`.
- Naprawiono `scripts/android-debug-smoke.ps1`, aby argumenty ADB takie jak `-p`, `-c` i `-p /sdcard/...` nie byly przechwytywane przez parser PowerShell.

### Pliki

- `apps/mobile/index.js`
- `apps/mobile/metro.config.js`
- `apps/mobile/package.json`
- `scripts/android-debug-smoke.ps1`
- `docs/progress.md`
- `docs/qa-mobile-notes.md`

### Testy

- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `gradlew assembleRelease --max-workers=1` w `C:\h-apk-0430-224852` - OK.
- Sourcemapa builda: `root react-native count = 0`, `app react-native count = 407`.
- `adb install -r builds\homeapp-release.apk` - OK.
- `adb shell am start -W -n com.homeapp.mobile/.MainActivity` - OK.
- Logcat po starcie: brak `E/ReactNativeJS`, `Invariant Violation`, `JavascriptException`, `TypeError`, `ReferenceError`.
- `scripts/android-debug-smoke.cmd -AllowUninstallOnSignatureMismatch -ClearData` - OK.
- ADB input na ekranie rejestracji: pole `Imie` przyjmuje `Jan` i nie kasuje wartosci - OK.

### Artefakty

- Aktualny dobry APK: `builds/homeapp-release.apk`.
- Stemplowany dobry APK: `builds/homeapp-release-20260430-2314.apk`.
- Screenshot: `adb-homeapp-smoke-20260430-231750.png`.
- Logcat: `adb-homeapp-smoke-20260430-231750.log`.
- UI dump: `adb-homeapp-smoke-20260430-231750.xml`.
- Screenshot rejestracji: `adb-homeapp-register-name.png`.

### Checklist items

- Nie zmieniono checklisty MVP. Naprawa potwierdza start APK i ekran logowania, ale nie jest jeszcze pelnym recznym testem rejestracji, logowania, resetu i utworzenia domu.

### Blokery

- Brak blokera startu APK na aktualnym buildzie.
- Google OAuth nadal wymaga prawdziwych client ID i testu end-to-end.

### Nastepny krok

- Na telefonie recznie przejsc: rejestracja -> akceptacja regulaminu/polityki -> utworzenie domu -> wejscie do dashboardu.
- Po potwierdzeniu przeplywu auth kontynuowac poprawki UX/UI oraz dopinanie kolejnych ekranow do realnych endpointow.

## 2026-05-01 - Przebudowa UX: widoki jako prezentacja danych, akcje w modalach

### Zakres

- Zmieniono wzorzec pracy na ekranach mobile: glowna tresc pokazuje zapisane dane, a dodawanie/edycja jest wywolywana z akcji u gory sekcji albo ekranu.
- Dodano wspolny komponent `FormModal` jako dolny modal formularzowy z naglowkiem, przyciskiem zamkniecia, body przewijanym i stopka akcji.
- Przeniesiono formularze do modali:
  - Finanse: dochod, kategoria, pozycja budzetu, wydatek.
  - Zakupy: dodanie produktu.
  - Plan: posilek, wydarzenie, zadanie, notatka/edycja notatki.
  - Dom: sprzatanie, koszt roczny, dane, zalacznik.
  - Wiecej: zaproszenie domownika.
- Dodano akcje w naglowkach: plus/dodaj/zmien/nowa, tak aby uzytkownik nie musial zgadywac gdzie wpisywac dane.

### Pliki

- `apps/mobile/src/ui/form-modal.tsx`
- `apps/mobile/src/ui/icon.tsx`
- `apps/mobile/src/ui/index.ts`
- `apps/mobile/app/(tabs)/finanse.tsx`
- `apps/mobile/app/(tabs)/zakupy.tsx`
- `apps/mobile/app/(tabs)/plan.tsx`
- `apps/mobile/app/(tabs)/dom.tsx`
- `apps/mobile/app/(tabs)/wiecej.tsx`
- `docs/progress.md`

### Testy

- `pnpm.cmd prettier --write ...` - OK.
- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `pnpm.cmd --filter @homeapp/mobile test` - OK, brak testow jednostkowych w pakiecie.

### Checklist items

- Nie odhaczono nowych punktow checklisty MVP. To jest zmiana UX i organizacji widokow; wymaga jeszcze testu manualnego na telefonie po kolejnym APK/dev buildzie.

### Blokery

- Brak blokera kodowego po typecheck/lint.
- Potrzebny test na fizycznym telefonie, zeby ocenic realny UX modali na Androidzie.

### Nastepny krok

- Uruchomic aplikacje na telefonie przez dev build albo zbudowac nowy APK i przejsc flow: logowanie/rejestracja -> dom -> finanse -> zakupy -> plan -> dom -> wiecej.

## 2026-05-01 - Widoczny przycisk `+ Dodaj` i aktualny APK na telefonie

### Zakres

- Doprecyzowano UI po uwadze z testu: akcje dodawania maja byc widoczne jako tekstowy przycisk `+ Dodaj`, a nie tylko jako ikona albo akcja ukryta w karcie.
- Finanse dostaly glowny przycisk `+ Dodaj` w naglowku ekranu oraz modal wyboru:
  - `+ Dodaj kategorie`,
  - `+ Dodaj pozycje budzetu`,
  - `+ Dodaj wydatek`,
  - `Zmien dochod`.
- Zakupy dostaly tekstowy przycisk `+ Dodaj` w naglowku.
- Plan i Dom maja tekstowe `+ Dodaj` w gornej akcji aktywnej sekcji.
- Wiecej ma tekstowy `+ Zapros` w akcji czlonkow domu.
- Zbudowano i wgrano na telefon aktualny APK.

### Pliki

- `apps/mobile/app/(tabs)/finanse.tsx`
- `apps/mobile/app/(tabs)/zakupy.tsx`
- `apps/mobile/app/(tabs)/plan.tsx`
- `apps/mobile/app/(tabs)/dom.tsx`
- `apps/mobile/app/(tabs)/wiecej.tsx`
- `docs/progress.md`

### Testy

- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `scripts/build-mobile-release-apk.cmd -ApiUrl 'http://192.168.100.109:3000/api'` - OK.
- `adb install -r builds\homeapp-release.apk` - OK.
- `adb shell am start -W -n com.homeapp.mobile/.MainActivity` - OK.
- ADB UI dump na ekranie Finansow potwierdza widoczny przycisk `+ Dodaj` w naglowku.
- ADB tap w `+ Dodaj` otwiera modal `Dodaj w finansach` z opcjami dodawania.

### Artefakty

- Aktualny APK: `builds/homeapp-release.apk`.
- Stemplowany APK: `builds/homeapp-release-20260501-0902.apk`.
- Screenshot: `adb-homeapp-finanse-menu.png`.
- UI dump: `adb-homeapp-finanse-add.xml`, `adb-homeapp-finanse-menu.xml`.

### Nastepny krok

- Przejsc recznie na telefonie po kartach Zakupy, Plan, Dom i Wiecej i ocenic, czy `+ Dodaj` jest wystarczajaco czytelny w kazdym module.

## 2026-05-01 - Research UX i pierwszy krok przebudowy shell/navigation

### Zakres

- Przejrzano aktualne wzorce Material/Android, Minimal UI/minimals.cc oraz Todoist.
- Spisano wnioski w osobnym dokumencie researchowym.
- Zmieniono pierwszy element architektury aplikacji:
  - dolna nawigacja ma teraz 5 glownych miejsc,
  - `Wiecej` nie zajmuje juz stalego miejsca jako szosty tab,
  - administracja/konto/uprawnienia sa dostepne przez przycisk `Menu` na ekranie Start.

### Pliki

- `docs/ux-redesign-research-2026-05-01.md`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `docs/progress.md`

### Zrodla

- Android layout/navigation patterns: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns
- Android adaptive navigation: https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation
- Material FAB: https://m1.material.io/components/buttons-floating-action-button.html
- Minimal UI layout: https://docs.minimals.cc/layout/
- Todoist dynamic add: https://www.todoist.com/help/articles/use-the-dynamic-add-button-in-todoist-ysybl2M1

### Testy

- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `scripts/build-mobile-release-apk.cmd -ApiUrl 'http://192.168.100.109:3000/api'` - OK.
- `adb install -r builds\homeapp-release.apk` - zablokowane: `adb devices` nie pokazal telefonu.

### Artefakty

- Aktualny APK: `builds/homeapp-release.apk`.
- Stemplowany APK: `builds/homeapp-release-20260501-0951.apk`.

### Nastepny krok

- Zaprojektowac i wdrozyc wspolny `QuickAddSheet` oraz przebudowac Start na centrum pracy zamiast kolekcji duzych kart.
- Po ponownym pojawieniu sie telefonu w ADB wgrac `builds/homeapp-release.apk` i sprawdzic dolna nawigacje oraz przycisk `Menu`.

## 2026-05-01 - Naprawa wylogowania i polskie bledy API

### Zakres

- Naprawiono wylogowanie z ekranu `Wiecej/Menu`:
  - `logout` jest teraz asynchroniczny i ustawia stan `signed-out` nawet jesli czyszczenie storage rzuci blad,
  - akcja wylogowania czysci cache TanStack Query,
  - po wylogowaniu aplikacja jawnie robi `router.replace('/')`, zeby nie zostac na ukrytej trasie `/(tabs)/wiecej`.
- Dodano centralne tlumaczenie odpowiedzi bledow backendu:
  - globalny filtr wyjatkow tlumaczy `message`,
  - detale walidacji sa tlumaczone na polski,
  - kody techniczne (`code`, `statusCode`) zostaja stabilne.

### Pliki

- `apps/mobile/src/session/session-context.tsx`
- `apps/mobile/app/(tabs)/wiecej.tsx`
- `apps/api/src/shared/http/api-error-messages.ts`
- `apps/api/src/shared/http/api-exception.filter.ts`
- `apps/api/src/shared/http/validation-exception.factory.ts`
- `apps/api/src/shared/http/api-exception.filter.spec.ts`
- `docs/progress.md`

### Testy

- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `pnpm.cmd --filter @homeapp/api typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api lint` - OK.
- `pnpm.cmd --filter @homeapp/api test` - OK, 20 testow.

### Blokery

- Telefon nie jest aktualnie widoczny w ADB (`adb devices` zwraca pusta liste), wiec nie potwierdzono jeszcze klikniecia `Wyloguj` na fizycznym urzadzeniu.

### Nastepny krok

- Po ponownym podlaczeniu telefonu wgrac APK/dev build i sprawdzic: `Menu` -> `Wyloguj` -> ekran logowania bez bialego ekranu.

## 2026-05-01 - Potwierdzona naprawa wylogowania na telefonie

### Zakres

- Usunieto konflikt routingu Expo Router:
  - ekran logowania zostal przeniesiony na osobna trase `app/login.tsx`,
  - `app/index.tsx` jest teraz lekka bramka startowa kierujaca do `/login` albo `/(tabs)`,
  - po wylogowaniu zakladki kieruja do jednoznacznego `/login`, a nie do konfliktowego `/`.
- Potwierdzono, ze poprzedni bialy ekran/spinner po wylogowaniu wynikaly z konfliktu `app/index.tsx` oraz `app/(tabs)/index.tsx`, bo obie trasy mapowaly sie do `/`.

### Pliki

- `apps/mobile/app/index.tsx`
- `apps/mobile/app/login.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/wiecej.tsx`
- `docs/progress.md`

### Testy

- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `scripts/build-mobile-release-apk.cmd -ApiUrl 'http://192.168.100.109:3000/api'` - OK.
- `adb install -r builds\homeapp-release.apk` - OK.
- Telefon `EHT7N19507003187`: logowanie `moskit17@gmail.com` - OK, ekran `Dzisiaj` widoczny.
- Telefon `EHT7N19507003187`: `Menu` -> `Wyloguj` - OK, aplikacja wraca do ekranu `Witaj ponownie` bez bialego ekranu i bez `Wracam do logowania...`.
- `adb logcat` po wylogowaniu - brak fatalnego bledu React Native / AndroidRuntime zwiazanego z aplikacja.

### Artefakty

- Aktualny APK: `builds/homeapp-release.apk`.
- Stemplowany APK: `builds/homeapp-release-20260501-1510.apk`.

### Nastepny krok

- Kontynuowac przebudowe UX modulow: widoki maja pokazywac zapisane dane, a dodawanie/edycja powinny otwierac modal z przyciskow akcji w naglowkach.

## 2026-05-01 - Pelne smoke QA backend + APK na telefonie

### Zakres

- Dodano powtarzalny smoke test backendu po prawdziwym HTTP API i lokalnej bazie PostgreSQL.
- Potwierdzono po ostatniej poprawce Metro, ze release bundle nie wraca do bledu `main has not been registered` ani `Cannot read property 'useRef' of null`.
- Zbudowano i wgrano aktualny release APK na telefon `EHT7N19507003187`.
- Przejscie na telefonie:
  - start APK i ekran logowania,
  - logowanie kontem `moskit17@gmail.com`,
  - ekran Start,
  - zakladki `Finanse`, `Plan`, `Zakupy`, `Dom`, `Start`,
  - `Menu` -> przewiniecie do ustawien konta -> `Wyloguj`,
  - powrot do ekranu `Witaj ponownie` bez bialego ekranu.

### Pliki

- `scripts/api-functional-smoke.ps1`
- `apps/mobile/metro.config.js`
- `builds/homeapp-release.apk`
- `docs/progress.md`
- `docs/qa-mobile-notes.md`

### Testy

- `pnpm.cmd typecheck` - OK.
- `pnpm.cmd lint` - OK.
- `pnpm.cmd test` - OK, backend 20 testow, mobile brak testow automatycznych.
- `pnpm.cmd build` - OK, Expo export Android/iOS po poprawce Metro.
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\api-functional-smoke.ps1 -BaseUrl 'http://localhost:3000/api'` - OK, 29 krokow smoke.
- `.\scripts\check-lan-dev.cmd` - OK, API LAN `http://192.168.100.109:3000/api`, Metro `http://192.168.100.109:8081`.
- `.\scripts\build-mobile-release-apk.cmd -ApiUrl 'http://192.168.100.109:3000/api'` - OK.
- `adb install -r .\builds\homeapp-release.apk` - OK.
- ADB smoke UI: wszystkie glowne zakladki renderuja oczekiwane teksty i nie pokazuja crash screenu.
- `adb logcat -d -t 1000` po smoke - brak krytycznych `ReactNativeJS`, `Invariant Violation`, `Cannot read property`, `TypeError`, `ReferenceError` zwiazanych z aplikacja.

### Backend smoke coverage

- Healthcheck, 401 bez tokena, rejestracja, weryfikacja e-mail, logowanie, bledne logowanie 401, wylogowanie.
- Dom, czlonkowie, zaproszenia, uprawnienia i utrata dostepu po usunieciu czlonka.
- Dashboard Start.
- Finanse: miesiac, kategoria, pozycja budzetowa, wydatek, dochod, summary, walidacja ujemnego scenariusza 400.
- Zakupy, plan posilkow, kalendarz, todo, notatki, sprzatanie, koszty roczne, dane i zalaczniki.
- Cleanup rekordow domenowych po smoke. Konta QA i dom QA zostaja w dev DB, bo nie ma jeszcze publicznego endpointu kasowania uzytkownika/domu.

### Artefakty

- Aktualny APK: `builds/homeapp-release.apk`.
- Stemplowany APK: `builds/homeapp-release-20260501-1547.apk`.

### Checklist items

- Nie zamknieto nowych checkboxow w `docs/checklista_mvp_i_akceptacji_v2.md`.
- Realtime multi-user pozostaje otwarty, bo nie wykonano jeszcze testu dwoch rownoleglych sesji.

### Ryzyka

- Google OAuth nadal wymaga prawdziwych client ID i testu end-to-end.
- SMTP/deep link verify/reset wymagaja realnego provider smoke poza dev tokenami.
- APK jest lokalnym release buildem do testow, nadal bez finalnego sklepowego podpisu.
- Mobile nadal nie ma automatycznych testow UI, obecny smoke jest ADB/manualny.

### Nastepny krok

- Kontynuowac przebudowe UX modulow w kierunku: widok danych jako domyslny ekran, akcje `+ Dodaj` w naglowku, formularze w modalach/sheetach.

## 2026-07-26 - Android: import wydatków z powiadomień i czytelniejsze finanse

### Zakres

- Dodano lokalny moduł Expo/Android z `NotificationListenerService`, Room, WorkManager i mostem do React Native.
- Źródła są wykrywane na podstawie faktycznie odebranych powiadomień; nie dodano `QUERY_ALL_PACKAGES`.
- Parser deterministyczny rozpoznaje typowe płatności PL/EN/DE/ES/FR i odrzuca OTP, saldo, oferty, przelewy przychodzące oraz operacje nieudane.
- Kolejka i ustawienia są szyfrowane AES-256-GCM kluczem Android Keystore, a indeksy osobnym HMAC-SHA-256.
- Dodano obsługę utraty klucza, jawny reset lokalnej kolejki, retencję i wyłączenie danych z backupu Androida.
- Dodano ekran zgody, ustawienia źródeł, godzinę prywatnego przypomnienia oraz ekran zbiorczego zatwierdzania.
- Przechwytywanie jest powiązane z profilem, domem, `finances/create` i ważnością lokalnej autoryzacji.
- Dodano `POST /finance/expenses/import` z wynikiem per element, atomową transakcją i trwałą idempotencją także po usunięciu wydatku.
- Rozszerzono wydatek o nazwę, źródło, czas operacji i opcjonalną kwotę/walutę źródłową.
- Zachowano AAD oraz kompatybilność starej koperty E2EE wydatku.
- W ręcznym dodawaniu nazwa wydatku jest wymagana w UI i widoczna w historii.
- Poprawiono hierarchię finansów rozmiarem, kolorem, kontrastem i odstępami bez zwiększania pogrubienia.
- Przebudowano README i dodano dokumentację funkcji, finansów oraz szyfrowania.

### Pliki

- `apps/mobile/modules/homeapp-notification-expense-import/**`
- `apps/mobile/app/notification-expense-import-settings.tsx`
- `apps/mobile/app/notification-expense-import.tsx`
- `apps/mobile/src/notification-expense-import/native.ts`
- `apps/mobile/app/(tabs)/finanse.tsx`
- `apps/api/src/modules/finance/**`
- `apps/api/src/modules/encryption/encryption.service.ts`
- `db/migrations/202607260001_notification_expense_import.sql`
- `docs/android-notification-expense-import.md`
- `docs/encryption.md`
- `docs/finances.md`
- `README.md`

### Testy

- `pnpm.cmd --filter @homeapp/api typecheck` - OK.
- `pnpm.cmd --filter @homeapp/api lint` - OK; pozostało jedno wcześniejsze ostrzeżenie `no-explicit-any` w teście meal planner.
- `pnpm.cmd --filter @homeapp/api test` - OK, 23 pliki i 91 testów.
- `pnpm.cmd --filter @homeapp/mobile typecheck` - OK.
- `pnpm.cmd --filter @homeapp/mobile lint` - OK.
- `pnpm.cmd --filter @homeapp/mobile test -- --runInBand` - OK, 3 zestawy i 13 testów.
- `pnpm.cmd typecheck` - OK, 6 zadań workspace.
- `pnpm.cmd lint` - OK, 6 zadań workspace; jedno wcześniejsze ostrzeżenie API.
- `pnpm.cmd --filter @homeapp/api build` - OK.
- `pnpm.cmd --filter @homeapp/mobile build` - OK, bundle Android i iOS.
- `:homeapp-notification-expense-import:testDebugUnitTest` - OK, 6 testów parsera.
- `:homeapp-notification-expense-import:connectedDebugAndroidTest` - OK, 3 testy AndroidX na emulatorze Pixel API 36.
- Scalony manifest debug zawiera listener, receiver, reguły backupu i nie zawiera `QUERY_ALL_PACKAGES`.
- `:app:assembleDebug` - OK w świeżym krótkim katalogu roboczym.
- Migracja Room `1 -> 2 -> 3 -> 4` - OK, w tym zachowanie ustawień, zakres profil/dom oraz leniwe przejęcie starych źródeł.
- Migracja PostgreSQL - OK od pustej bazy na izolowanym lokalnym PostgreSQL 18, baza `homeapp_release_gate_20260726_1847`.
- E2E prawdziwego lokalnego API - OK: ręczny wydatek, import `BIEDRONKA 79,99 PLN`, ponowienie jako `duplicate` i odświeżony budżet.
- E2E emulatora - OK: przechwycenie płatności ze źródła `Shell`, ikona źródła, nazwa `BIEDRONKA`, kwota `79,99 PLN`, wybór budżetu i podsumowanie końcowe.
- Standalone APK z produkcyjnym adresem API i konfiguracją OAuth - OK; `versionName=1.1.0`, `versionCode=101`, `minSdk=24`, `targetSdk=35`, podpis APK v2 poprawny.

### Emulator

- `emulator-5554` jest dostępny jako Pixel API 36.
- Zainstalowana wcześniej aplikacja ma `versionName=1.1.0`, `versionCode=101`.
- Listener HomeApp został włączony i przetestowany dla wybranego źródła `Shell`.
- Debug APK zainstalowano, a konto testowe utworzono wyłącznie w izolowanym lokalnym środowisku.
- Potwierdzono przechwytywanie bez procesu JavaScript, prywatne przypomnienie, cold-start deep link oraz zachowanie po restarcie emulatora.
- Samodzielnego APK z produkcyjnym adresem API nie instalowano na emulatorze; testy urządzeniowe wykonano debug APK zgodnie z zakresem zgody.

### Ograniczenia

- Nie testowano treści z rzeczywistej aplikacji bankowej; systemowy pipeline Androida sprawdzono powiadomieniami publikowanymi przez `Shell`.
- `builds/homeapp-release.apk` jest testowym buildem standalone podpisanym certyfikatem `CN=Android Debug`, nie artefaktem produkcyjnym. SHA-256: `837420DD7CFBC3DB4345E9DD71AD672E8AA929C5FC78495D7F6594B8DDE932BE`.
- Nie ma skonfigurowanego właściwego klucza wydania (`HOMEAPP_ANDROID_KEYSTORE_PATH`, alias i hasła), więc nie wolno publikować obecnego APK jako produkcyjnego.
- Modale w `login.tsx` i `auth/invitation.tsx` nadal oznaczają politykę prywatności jako roboczy podgląd. Finalna treść, administrator danych i kontakt muszą zostać zatwierdzone przed wdrożeniem.
- Nie scalono, nie wypchnięto ani nie wdrożono zmian na produkcję, ponieważ dwa powyższe warunki release gate nie są spełnione.
