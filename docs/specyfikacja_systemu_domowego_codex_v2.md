# Specyfikacja systemu – rodzinny organizer domu (wersja wykonawcza v2)

## 1. Cel produktu

Aplikacja ma zastąpić Excela i rozproszone notatki jednym wspólnym systemem do zarządzania domem i rodziną.
Priorytety produktu:
- prostota,
- szybkość obsługi,
- minimum pól i kliknięć,
- współdzielenie danych w ramach domu,
- pełna synchronizacja zmian między członkami domu,
- automatyzacja tam, gdzie zastępuje ręczne przepisywanie.

System ma obsługiwać:
- finanse miesięczne zgodne z logiką Excela,
- plan jedzenia,
- kalendarz,
- to-do i notatki,
- zakupy,
- sprzątanie cykliczne,
- koszty roczne,
- dane,
- załączniki,
- dom, członków i role.

## 2. Stack technologiczny

Przyjęty stack:
- mobile: React Native + Expo + TypeScript
- backend: NestJS + TypeScript
- baza danych: PostgreSQL
- auth: własny backend JWT + refresh tokeny
- storage: lokalny/S3-compatible backend
- API: REST
- synchronizacja zmian: SSE lub WebSocket
- pliki: backend storage bez Supabase

Założenia:
- aplikacja działa online,
- brak trybu offline w MVP,
- backend jest jedynym źródłem prawdy,
- klient nie liczy logiki biznesowej samodzielnie, poza prostą prezentacją danych.

## 3. Architektura produktu

System składa się z 4 głównych warstw:
1. aplikacja mobilna,
2. backend API,
3. baza PostgreSQL,
4. auth, storage i infrastruktura pomocnicza.

Repozytorium powinno być monorepo:
- apps/mobile
- apps/api
- packages/shared-types
- packages/shared-validation
- packages/eslint-config
- packages/tsconfig

## 4. Główne zasady domenowe

- Każdy użytkownik należy do jednego domu.
- Dom jest wspólną przestrzenią danych.
- W domu jest dokładnie jeden właściciel.
- Pozostali użytkownicy są członkami z konfigurowalnymi uprawnieniami.
- Brak uprawnienia read ukrywa moduł w aplikacji.
- Uprawnienia są sprawdzane po stronie backendu.
- Dane zawsze filtrowane są po household_id.
- Miesiąc budżetowy jest kluczowym bytem całego systemu.
- W domu istnieje tylko jeden bieżący miesiąc budżetowy.
- Kolejny miesiąc jest generowany ręcznie i jest kopią poprzedniego.
- Zachowanie układu miesiąca jest ważniejsze niż nadmierna elastyczność.

## 5. Nawigacja mobilna

Dolna nawigacja:
- Start
- Finanse
- Plan
- Zakupy
- Dom
- Więcej

## 6. Moduły funkcjonalne

## 6.1 Start

Start ma być prostym dashboardem dziennym.
Ma pokazywać:
- podsumowanie bieżącego miesiąca finansowego,
- najbliższe wydarzenia z kalendarza,
- podgląd aktualnego planu jedzenia,
- opcjonalnie skrót do to-do, jeśli układ pozostaje czytelny.

Nie pokazujemy na starcie:
- zakupów,
- sprzątania,
- kosztów rocznych,
- danych,
- załączników.

Domyślna kolejność sekcji:
1. finanse,
2. wydarzenia,
3. jedzenie,
4. to-do.

## 6.2 Finanse

To główny moduł systemu.

### Zasady ogólne
- Budżet jest wspólny na poziomie domu.
- Każda pozycja budżetowa ma jednego właściciela.
- Widok grupowany jest najpierw po osobie, potem po kategorii.
- Kategorie są wspólne dla domu.
- Kategorię wybieramy lub tworzymy w trakcie tworzenia pozycji.
- Każdy wydatek musi należeć do konkretnej pozycji budżetowej.
- Nie ma wydatków luźnych.
- Nie ma osobnego modułu rachunków.
- Rachunki to zwykłe pozycje budżetowe.
- Nie ma pola opłacone / nieopłacone.

### Pozycja budżetowa
Pola:
- owner
- category
- name
- budget_amount
- spent_amount
- remaining_amount

Zasady:
- spent_amount liczymy jako sumę expenses,
- remaining_amount = budget_amount - spent_amount,
- remaining_amount może być ujemne,
- budget_amount może być NULL,
- budget_amount może wynosić 0.

### Pojedynczy wydatek
Pola:
- budget_item_id
- amount
- created_at

Zasady:
- bez osobnej daty biznesowej,
- bez opisu,
- bez załączników,
- tylko dodatnie wartości.

### Dochody
- dla każdej osoby jedna łączna kwota dochodu na miesiąc,
- wpisywana ręcznie co miesiąc,
- w archiwum dochód traktowany jako nieedytowalny.

### Podsumowanie finansów na osobę
Widok musi pokazywać:
- dochód,
- sumę budżetów,
- wydano,
- pozostało.

### Miesiące budżetowe
- tylko jeden bieżący miesiąc,
- kolejny miesiąc tworzymy ręcznie,
- poprzedni trafia do archiwum,
- archiwum to lista miesięcy,
- bez porównania miesiąc do miesiąca,
- archiwalne miesiące można poprawiać, z wyjątkiem dochodu.

### Kopiowanie miesiąca
Nowy miesiąc jest kopią poprzedniego.
Kopiujemy:
- układ,
- kolejność,
- pozycje,
- właścicieli,
- kategorie.

Nie kopiujemy:
- wydatków.

### Kopiowanie budżetów po kategorii
Kategoria ma flagę:
- copy_budget_to_next_month

Jeśli true:
- budżety pozycji z tej kategorii kopiują się.

Jeśli false:
- pozycje powstają z pustym budżetem.

### Zasady wynikające z kopii miesiąca
- jeśli pozycja została usunięta w bieżącym miesiącu, nie pojawi się w następnym,
- kolejny miesiąc zawsze odzwierciedla stan poprzedniego na moment generowania,
- pozycje z 0 wydatków są nadal widoczne.

### Zakładki modułu Finanse
- Miesiąc
- Archiwum

Nie tworzymy osobnej zakładki „Rachunki”.

## 6.3 Plan → Jedzenie

Planner działa tygodniowo.

### Zasady
- tydzień zaczyna się od poniedziałku,
- dni tygodnia są sztywne: poniedziałek–niedziela,
- liczba slotów posiłków dziennie jest ustawieniem domu,
- slot przechowuje jedną pozycję tekstową,
- wpis ma:
  - nazwę,
  - opcjonalny link,
  - opcjonalną notatkę.

### Funkcjonalność
- tworzenie planu tygodnia,
- historia tygodni,
- kopiowanie wcześniejszego tygodnia,
- losowanie propozycji na podstawie historii,
- wykluczanie posiłków z ostatnich tygodni,
- osobna sekcja inspiracje / zachcianki / przyszły tydzień.

Domyślne założenie wykonawcze:
- wykluczamy ostatnie 3 tygodnie przy losowaniu,
- wartość ma być konfigurowalna w kodzie.

## 6.4 Plan → Kalendarz

### Wydarzenie
Pola:
- title
- date
- time
- note
- scope_type
- owner_member_id nullable
- recurrence_rule nullable

### Zasady
- wydarzenia mogą być cykliczne,
- wydarzenie może dotyczyć domu albo osoby,
- brak typów wydarzeń,
- brak załączników,
- kalendarz ma widoki dzień / tydzień / miesiąc,
- tydzień zaczyna się od poniedziałku,
- najbliższe wydarzenia trafiają na ekran startowy.

## 6.5 Plan → To-do i notatki

Jeden moduł, dwie zakładki:
- To-do
- Notatki

### To-do
Pola:
- title
- description
- scope_type
- owner_member_id nullable
- status

Zasady:
- brak terminu,
- brak cykliczności,
- brak etykiet,
- statusy:
  - todo
  - done

### Notatki
Pola:
- title
- description

Zasady:
- brak statusu,
- brak przypisania,
- brak terminu,
- brak etykiet.

## 6.6 Zakupy

Są dokładnie dwie listy:
- codzienne,
- długoterminowe.

### Element listy
Pola:
- name
- quantity
- is_checked
- checked_at
- display_order

Zasady:
- lista wspólna dla domu,
- brak kategorii,
- brak notatek,
- brak przypisania do osoby,
- po zaznaczeniu pozycja spada na dół i jest wyszarzona,
- ten sam model działa dla obu list,
- brak przenoszenia między listami,
- brak sekcji zakupów na ekranie startowym.

## 6.7 Dom → Sprzątanie

### Zadanie sprzątania
Pola:
- name
- frequency_mode
- frequency_days
- completion_window_days
- next_due_at

Zasady:
- nazwa jest prostym tekstem,
- częstotliwość może być gotowa lub w dniach,
- completion_window_days określa okno wykonania,
- po wykonaniu kolejny termin liczony jest od dnia wykonania,
- zadania są wspólne dla domu,
- występuje tylko pojęcie zaległe,
- historia przechowuje daty wykonania,
- główny widok to lista do zrobienia z zaległymi na górze,
- bez sekcji na starcie.

Domyślne sortowanie:
1. zaległe,
2. najbliższe,
3. dalsze.

## 6.8 Dom → Koszty roczne

Dotyczy tylko rzeczy wracających raz do roku.

### Wpis
Pola:
- name
- default_amount nullable
- next_due_date

### Zasady
- wspólne dla domu,
- bez załączników,
- po oznaczeniu wykonania zapis do historii,
- kolejny termin = data wykonania + 1 rok,
- historia zawiera datę i kwotę,
- historia ma filtr po roku,
- można mieć proste podsumowanie,
- bez sekcji na starcie.

## 6.9 Dom → Dane

To prosty wspólny schowek.

### Wpis
Pola:
- title
- value

Zasady:
- płaska lista,
- brak kategorii,
- brak folderów,
- wspólne dla domu,
- wyszukiwarka po title i value,
- mogą tam być dowolne dane.

Domyślne zachowanie:
- sortowanie po updated_at malejąco.

## 6.10 Dom → Załączniki

To osobny moduł.

### Załącznik
Pola:
- file
- caption

Typy:
- image
- pdf

Zasady:
- płaska lista,
- brak kategorii,
- brak powiązania z innymi modułami w MVP,
- wspólne dla domu,
- wyszukiwarka po caption,
- sortowanie po created_at malejąco.

## 6.11 Dom i rodzina

### Zasady
- użytkownik należy do jednego domu,
- nowi członkowie dołączają przez zaproszenie e-mail,
- dziecko ma zwykłe konto z logowaniem,
- tylko właściciel ma pełne uprawnienia,
- właściciel zarządza członkami i ich uprawnieniami,
- po usunięciu członek natychmiast traci dostęp.

## 6.12 Auth i status konta

### Metody logowania
- e-mail + hasło
- Google OAuth

### Dodatkowe funkcje
- reset hasła przez e-mail
- potwierdzenie e-mail

### Statusy konta
- inactive
- active
- banned

Domyślne zasady:
- nowe konto po rejestracji lub zaproszeniu ma status inactive,
- po weryfikacji e-mail i poprawnym wejściu do domu przechodzi na active,
- banned blokuje logowanie.

## 7. Role i uprawnienia

Model uprawnień:
- read
- create
- update
- delete

Uprawnienia są ustawiane per moduł.
Minimalne moduły uprawnień:
- start
- finances
- meal_planner
- calendar
- todo
- notes
- shopping
- cleaning
- annual_costs
- data_entries
- attachments
- household_members
- permissions

Zasady:
- brak read = moduł ukryty,
- read bez create/update/delete = tylko odczyt,
- owner ma pełen dostęp do wszystkiego.

## 8. Automatyzacje MVP

- generowanie nowego miesiąca,
- archiwizacja poprzedniego miesiąca,
- kopiowanie układu budżetu,
- kopiowanie budżetu według flagi kategorii,
- automatyczne liczenie spent i remaining,
- wyliczanie kolejnego terminu sprzątania,
- wyliczanie kolejnego terminu kosztu rocznego,
- losowanie jedzenia na podstawie historii.

## 9. Synchronizacja między użytkownikami

Po każdej zmianie:
- backend zapisuje zmianę,
- backend emituje zdarzenie realtime dla danego domu,
- klient invaliduje cache odpowiedniego modułu,
- po powrocie aplikacji na foreground klient wykonuje refresh.

Minimalne zdarzenia:
- finance.changed
- finance.month.generated
- meal.changed
- calendar.changed
- todo.changed
- note.changed
- shopping.changed
- cleaning.changed
- annual_cost.changed
- data.changed
- attachment.changed
- permissions.changed
- household.changed

## 10. Funkcje rozwojowe

Nie implementować w MVP, ale zostawić miejsce:
- szybkie dodawanie,
- powiadomienia,
- PIN / biometria,
- AI dla plannera jedzenia.

## 11. AI – rozwój

Zakres AI:
- analiza historii posiłków,
- wykrywanie często używanych dań,
- unikanie powtórzeń,
- podpowiadanie nowych posiłków podobnych do poprzednich.

W MVP:
- bez modelu AI,
- tylko algorytmiczne losowanie z historii.

## 12. UX i zasady interfejsu

- minimum pól,
- minimum kliknięć,
- krótkie formularze,
- jeden główny cel na ekran,
- listy jako podstawowy wzorzec UI,
- brak przeładowania,
- układ na jedną rękę,
- ważne akcje widoczne bez głębokiej nawigacji.

Domyślne decyzje UX:
- formularze create/edit jako osobne ekrany lub bottom sheet, zależnie od modułu,
- confirm dialog tylko dla usuwania,
- wszystkie listy mają pull-to-refresh,
- wyszukiwarki tylko tam, gdzie zostały uzgodnione.

## 13. Model danych PostgreSQL

### households
- id
- name
- currency_code
- week_starts_on
- meal_slots_per_day
- created_at
- updated_at

### users
- id
- auth_provider_user_id
- email
- display_name
- account_status
- created_at
- updated_at

### household_members
- id
- household_id
- user_id
- role
- is_active
- joined_at
- removed_at

### member_permissions
- id
- household_member_id
- module_key
- can_read
- can_create
- can_update
- can_delete
- created_at
- updated_at

### invitations
- id
- household_id
- email
- invited_by_user_id
- token
- expires_at
- accepted_at
- created_at
- updated_at

### budget_months
- id
- household_id
- year
- month
- source_budget_month_id nullable
- is_current
- generated_at
- archived_at nullable
- created_at
- updated_at

### budget_categories
- id
- household_id
- name
- display_order
- copy_budget_to_next_month
- is_active
- created_at
- updated_at

### budget_items
- id
- budget_month_id
- owner_member_id
- category_id
- name
- budget_amount nullable
- display_order
- is_deleted
- created_at
- updated_at

### expenses
- id
- budget_item_id
- amount
- created_at
- updated_at

### monthly_incomes
- id
- budget_month_id
- owner_member_id
- amount
- created_at
- updated_at

### meal_plan_weeks
- id
- household_id
- week_start_date
- created_at
- updated_at

### meal_plan_entries
- id
- meal_plan_week_id
- weekday
- slot_index
- meal_name
- link_url nullable
- note nullable
- created_at
- updated_at

### meal_ideas
- id
- household_id
- title
- note nullable
- link_url nullable
- created_at
- updated_at

### calendar_events
- id
- household_id
- scope_type
- owner_member_id nullable
- title
- event_date
- event_time
- note nullable
- recurrence_rule nullable
- created_at
- updated_at

### todo_items
- id
- household_id
- scope_type
- owner_member_id nullable
- title
- description
- status
- created_at
- updated_at

### note_items
- id
- household_id
- title
- description
- created_at
- updated_at

### shopping_lists
- id
- household_id
- type
- name
- created_at
- updated_at

### shopping_list_items
- id
- shopping_list_id
- name
- quantity
- is_checked
- checked_at nullable
- display_order
- created_at
- updated_at

### cleaning_tasks
- id
- household_id
- name
- frequency_mode
- frequency_days
- completion_window_days
- next_due_at
- created_at
- updated_at

### cleaning_task_history
- id
- cleaning_task_id
- completed_at
- completed_by_member_id nullable
- created_at

### annual_costs
- id
- household_id
- name
- default_amount nullable
- next_due_date
- created_at
- updated_at

### annual_cost_history
- id
- annual_cost_id
- executed_at
- amount nullable
- created_at

### data_entries
- id
- household_id
- title
- value
- created_at
- updated_at

### attachments
- id
- household_id
- storage_path
- mime_type
- file_name
- caption
- created_by_member_id nullable
- created_at
- updated_at

## 14. Widoki agregujące i zapytania pomocnicze

### v_budget_item_totals
- budget_item_id
- spent_amount
- remaining_amount

### v_budget_person_summary
- budget_month_id
- owner_member_id
- income_amount
- total_budget_amount
- total_spent_amount
- total_remaining_amount

### v_cleaning_overview
- cleaning_task_id
- is_overdue
- next_due_at

### v_annual_cost_history_by_year
- annual_cost_id
- executed_year
- total_amount

## 15. Backend – moduły

- AuthModule
- UsersModule
- HouseholdsModule
- InvitationsModule
- PermissionsModule
- FinanceModule
- MealPlannerModule
- CalendarModule
- TodoModule
- NotesModule
- ShoppingModule
- CleaningModule
- AnnualCostsModule
- DataEntriesModule
- AttachmentsModule
- RealtimeModule

## 16. Zabezpieczenia

- JWT access + refresh,
- private storage,
- auth guard na wszystkich endpointach prywatnych,
- permission guard per moduł i akcja,
- sprawdzanie household_id na każdym zapytaniu,
- brak zaufania do danych z klienta,
- banned blokuje sesję,
- miejsce na późniejsze szyfrowanie wrażliwych danych.

## 17. API – kontrakt wysokiego poziomu

### auth
- POST /auth/register
- POST /auth/login
- POST /auth/google
- POST /auth/forgot-password
- POST /auth/reset-password
- POST /auth/verify-email
- POST /auth/refresh
- POST /auth/logout

### household
- POST /households
- GET /households/me
- PATCH /households/me
- GET /households/me/members
- POST /households/me/invitations
- DELETE /households/me/members/:id
- PATCH /households/me/members/:id/permissions

### finance
- GET /finance/current-month
- POST /finance/months/generate-next
- GET /finance/months/archive
- GET /finance/months/:id
- GET /finance/months/:id/person-summary
- GET /finance/categories
- POST /finance/categories
- PATCH /finance/categories/:id
- POST /finance/budget-items
- PATCH /finance/budget-items/:id
- DELETE /finance/budget-items/:id
- POST /finance/expenses
- DELETE /finance/expenses/:id
- PUT /finance/incomes/:memberId

### meal-plans
- GET /meal-plans/current
- GET /meal-plans/history
- POST /meal-plans
- PATCH /meal-plans/:id
- POST /meal-plans/:id/copy
- POST /meal-plans/randomize
- GET /meal-ideas
- POST /meal-ideas
- PATCH /meal-ideas/:id
- DELETE /meal-ideas/:id

### calendar
- GET /calendar/events
- POST /calendar/events
- PATCH /calendar/events/:id
- DELETE /calendar/events/:id

### todo
- GET /todo
- POST /todo
- PATCH /todo/:id
- DELETE /todo/:id

### notes
- GET /notes
- POST /notes
- PATCH /notes/:id
- DELETE /notes/:id

### shopping
- GET /shopping-lists
- GET /shopping-lists/:type/items
- POST /shopping-lists/:type/items
- PATCH /shopping-lists/items/:id
- DELETE /shopping-lists/items/:id
- POST /shopping-lists/items/:id/check

### cleaning
- GET /cleaning
- POST /cleaning
- PATCH /cleaning/:id
- DELETE /cleaning/:id
- POST /cleaning/:id/complete
- GET /cleaning/:id/history

### annual-costs
- GET /annual-costs
- POST /annual-costs
- PATCH /annual-costs/:id
- DELETE /annual-costs/:id
- POST /annual-costs/:id/complete
- GET /annual-costs/history?year=YYYY

### data-entries
- GET /data-entries
- POST /data-entries
- PATCH /data-entries/:id
- DELETE /data-entries/:id

### attachments
- GET /attachments
- POST /attachments/upload-url
- POST /attachments
- PATCH /attachments/:id
- DELETE /attachments/:id

## 18. Zachowania szczególne

### Generowanie miesiąca
1. pobierz bieżący miesiąc,
2. utwórz nowy miesiąc,
3. skopiuj pozycje nieusunięte,
4. zachowaj kolejność,
5. budżet skopiuj tylko dla kategorii z copy_budget_to_next_month=true,
6. nie kopiuj wydatków,
7. utwórz puste dochody dla członków lub pozwól na ręczne wpisanie przed użyciem widoku,
8. poprzedni miesiąc oznacz jako niebieżący i zarchiwizowany,
9. nowy ustaw jako bieżący.

### Sprzątanie
Po complete:
- zapis historii,
- next_due_at = completed_at + frequency,
- odświeżenie listy.

### Koszty roczne
Po complete:
- zapis historii,
- next_due_date = completed_at + 1 year.

### Zakupy
Po check:
- is_checked = true,
- checked_at = now,
- element sortowany na koniec.

### Jedzenie – losowanie
- baza: historia,
- filtr: pomiń ostatnie 3 tygodnie,
- losowanie tylko z odpowiadającego slotu, jeśli slot jest wskazany.

## 19. Testy

Minimalne testy:
- generowanie miesiąca,
- kopiowanie budżetów według kategorii,
- liczenie spent i remaining,
- permission guards,
- sprzątanie,
- koszty roczne,
- podstawowe ścieżki auth,
- E2E dla kluczowych flow.

## 20. Funkcje rozwojowe

### szybkie dodawanie
Globalny punkt wejścia do szybkiego dodawania:
- wydatku,
- pozycji budżetowej,
- wydarzenia,
- zadania,
- zakupu.

### powiadomienia
- wydarzenia,
- sprzątanie,
- koszty roczne,
- ewentualnie to-do.

### PIN / biometria
Blokada wejścia do aplikacji po stronie mobile.

### AI
Sugestie jedzenia na podstawie historii.

## 21. Weryfikacja pokrycia

System pokrywa:
- wspólny dom,
- role i uprawnienia,
- budżet miesięczny zgodny z Excelem,
- dochody,
- archiwum,
- kopiowanie kolejnych miesięcy,
- plan jedzenia,
- kalendarz,
- to-do,
- notatki,
- zakupy,
- sprzątanie,
- koszty roczne,
- dane,
- załączniki,
- synchronizację,
- funkcje rozwojowe.

## 22. Decyzje domyślne dopisane wykonawczo

Poniższe rzeczy zostały domknięte wykonawczo tam, gdzie nie padła ostateczna decyzja:
- Start pokazuje finanse, wydarzenia, jedzenie i opcjonalnie to-do.
- Dane sortują się po updated_at malejąco.
- Załączniki sortują się po created_at malejąco.
- Sprzątanie sortuje zaległe najpierw.
- Losowanie jedzenia wyklucza domyślnie 3 ostatnie tygodnie.
- Kategorie finansowe mają display_order.
- Shopping list items mają display_order i checked_at.
- Notatki mają title + description.
