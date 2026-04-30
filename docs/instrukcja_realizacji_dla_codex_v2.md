# Instrukcja realizacji dla Codex – system domowy v2

## Cel
Masz zbudować produkcyjny system mobilny zgodnie ze specyfikacją.
Nie dodawaj własnych funkcji.
Nie rozszerzaj zakresu.
Najpierw backend i model danych, potem frontend.

## Główne zasady pracy
- trzymaj się specyfikacji 1:1,
- jeśli decyzja nie została opisana, użyj domyślnej decyzji ze specyfikacji,
- nie twórz „sprytnych” uproszczeń zmieniających logikę biznesową,
- finanse są rdzeniem systemu,
- prostota UI jest ważniejsza niż elastyczność.

## Docelowa struktura repozytorium
Monorepo:
- apps/mobile
- apps/api
- packages/shared-types
- packages/shared-validation
- packages/eslint-config
- packages/tsconfig

Manager pakietów:
- pnpm

Build orchestration:
- turbo

## Etap 1 – bootstrap projektu
Zrób:
1. utworzenie monorepo,
2. konfigurację TypeScript,
3. konfigurację ESLint i Prettier,
4. konfigurację env dla mobile i api,
5. podstawowe README.

Wynik etapu:
- działające monorepo,
- odpalalny backend,
- odpalalna aplikacja Expo,
- wspólny pakiet typów.

## Etap 2 – baza danych i migracje
Zrób:
1. zaprojektuj schemat PostgreSQL zgodny ze specyfikacją,
2. przygotuj migracje,
3. przygotuj enumy i constrainty,
4. przygotuj indeksy,
5. przygotuj widoki agregujące.

Wymagania:
- wszystkie tabele muszą mieć household_id tam, gdzie jest to wymagane domenowo,
- wszystkie relacje muszą być jawne,
- zachowaj unikalności tam, gdzie mają sens,
- zabezpiecz możliwość tylko jednego bieżącego miesiąca na dom.

Krytyczne rzeczy:
- budget_months,
- budget_categories,
- budget_items,
- expenses,
- monthly_incomes,
- household_members,
- member_permissions.

## Etap 3 – auth, użytkownicy, dom
Zrób:
1. własny backend auth,
2. rejestrację e-mail + hasło,
3. logowanie,
4. Google OAuth,
5. verify email,
6. forgot/reset password,
7. model users,
8. model households,
9. invitations,
10. dołączanie do domu,
11. statusy inactive/active/banned.

Wymagania:
- użytkownik należy tylko do jednego domu,
- tylko owner tworzy zaproszenia,
- usunięcie członka odcina dostęp natychmiast,
- konto banned nie może korzystać z API.

## Etap 4 – uprawnienia
Zrób:
1. model permissions,
2. permission guard,
3. household guard,
4. helper do sprawdzania read/create/update/delete,
5. endpoint do edycji uprawnień.

Wymagania:
- backend egzekwuje uprawnienia,
- frontend tylko ukrywa moduły wtórnie,
- brak read blokuje dostęp do danych i do widoku.

## Etap 5 – finanse
To etap krytyczny. Zrób go dokładnie.

### 5.1 Kategorie
- lista kategorii domu,
- create/update,
- display_order,
- copy_budget_to_next_month.

### 5.2 Miesiąc bieżący
- endpoint pobrania miesiąca,
- agregacja pozycji,
- grupowanie owner -> category,
- podsumowanie na osobę.

### 5.3 Pozycje budżetowe
- create,
- update,
- delete logiczne w bieżącym miesiącu.

### 5.4 Wydatki
- create expense,
- delete expense,
- automatyczne przeliczenie spent i remaining.

### 5.5 Dochody
- jedna wartość miesięczna per osoba,
- update tylko dla bieżącego miesiąca.

### 5.6 Generowanie nowego miesiąca
- kopiuj poprzedni miesiąc,
- kopiuj układ i kolejność,
- kopiuj budżet według flagi kategorii,
- nie kopiuj wydatków,
- dochody przygotuj puste,
- poprzedni miesiąc archiwizuj.

### 5.7 Archiwum
- lista miesięcy,
- podgląd archiwalnego miesiąca,
- brak porównania miesiąc do miesiąca.

### 5.8 Testy finansów
- generowanie miesiąca,
- kopiowanie budżetu,
- usuwanie pozycji a kolejne miesiące,
- liczenie spent,
- liczenie remaining,
- ograniczenia uprawnień.

## Etap 6 – planner jedzenia
Zrób:
1. tygodnie planów,
2. wpisy slotów,
3. historię,
4. kopiowanie tygodnia,
5. sekcję inspiracji,
6. losowanie z historii.

Wymagania:
- tydzień od poniedziałku,
- liczba slotów z ustawień domu,
- wykluczenie ostatnich 3 tygodni domyślnie.

## Etap 7 – kalendarz
Zrób:
- CRUD wydarzeń,
- scope dom / osoba,
- cykliczność,
- widoki danych dla dnia/tygodnia/miesiąca,
- lista najbliższych wydarzeń na start.

## Etap 8 – to-do i notatki
Zrób:
- osobne encje,
- jedna sekcja w aplikacji,
- dwie zakładki,
- statusy todo/done dla zadań,
- notatki bez statusów.

## Etap 9 – zakupy
Zrób:
- dwie stałe listy dla domu,
- pozycje z quantity,
- checkbox,
- checked_at,
- sortowanie aktywne najpierw.

## Etap 10 – sprzątanie
Zrób:
- definicje zadań,
- częstotliwość,
- completion window,
- next_due_at,
- complete action,
- history.

Widok danych ma zwracać:
- zaległe,
- do zrobienia,
- ostatnio wykonane.

## Etap 11 – koszty roczne
Zrób:
- definicje kosztów,
- historia wykonania,
- complete action,
- filtr historii po roku,
- proste podsumowanie.

## Etap 12 – dane
Zrób:
- płaską listę title/value,
- wyszukiwarkę backendową i frontendową,
- sortowanie po updated_at malejąco.

## Etap 13 – załączniki
Zrób:
- upload URL,
- zapis metadanych,
- lista plików,
- wyszukiwarkę po caption,
- prywatny storage,
- obsługę image/pdf.

## Etap 14 – start dashboard
Zrób:
- sekcja finansów,
- sekcja najbliższych wydarzeń,
- sekcja aktualnego tygodnia jedzenia,
- opcjonalnie skrót do todo.

Nie dodawaj innych sekcji.

## Etap 15 – realtime
Zrób:
- kanał household-level,
- broadcast po mutacjach,
- client invalidation.

Nie implementuj skomplikowanego collaborative editing.
Wystarczy:
- zapis,
- event,
- odświeżenie dotkniętego zasobu.

## Etap 16 – frontend mobilny
Zasady:
- użyj Expo Router,
- TanStack Query,
- react-hook-form,
- zod,
- prosty design system,
- brak przeładowania.

### Ekrany
- Start
- Finanse
- Plan
- Zakupy
- Dom
- Więcej

### Zakładki wewnętrzne
- Finanse: Miesiąc, Archiwum
- Plan: Jedzenie, Kalendarz, To-do, Notatki
- Dom: Sprzątanie, Koszty roczne, Dane, Załączniki

### Permission guards
- moduł bez read nie może się renderować,
- brak create/update/delete ma blokować akcje.

## Etap 17 – jakość i testy
Zrób:
- unit tests backendu dla logiki domenowej,
- integration tests dla auth i permissions,
- smoke tests frontendowe,
- podstawowe E2E.

## Etap 18 – co nie wchodzi do MVP
Nie implementuj:
- szybkiego dodawania,
- powiadomień,
- PIN/biometrii,
- AI,
- osobnego modułu rachunków,
- powiązań załączników z innymi modułami,
- offline mode.

## Standard odpowiedzi Codex po każdym etapie
Po każdym etapie pokaż:
1. co zrobiłeś,
2. jakie pliki powstały,
3. jakie decyzje wykonawcze podjąłeś,
4. czego dotyczy następny etap.

## Kolejność pracy
1. repo
2. db
3. auth + household
4. permissions
5. finances
6. meal planner
7. calendar
8. todo + notes
9. shopping
10. cleaning
11. annual costs
12. data
13. attachments
14. dashboard
15. realtime
16. polish + tests

## Krytyczne zakazy
- nie zmieniaj logiki kopiowania miesiąca,
- nie rozbijaj rachunków na osobny moduł,
- nie komplikuj zakupów,
- nie dodawaj tagów do to-do,
- nie dodawaj dat do wydatków,
- nie dodawaj kategorii do zakupów,
- nie dodawaj załączników do wydatków,
- nie implementuj AI w MVP.
