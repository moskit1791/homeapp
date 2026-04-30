# Agent DB

## Cel
Przygotować schemat PostgreSQL zgodny ze specyfikacją i gotowy do użycia przez backend.

## Zakres
- Migracje SQL w `db/migrations`.
- Enumy, tabele, relacje, indeksy, constrainty i widoki.
- Szczególna kontrola `household_id` i integralności finansów.

## Krytyczne reguły
- Tylko jeden bieżący miesiąc budżetowy per dom.
- Dokładnie jeden owner per dom.
- Użytkownik należy do jednego aktywnego domu.
- `expenses.amount` musi być dodatnie.
- `spent_amount` nie jest źródłem prawdy, wynika z `expenses`.
- `remaining_amount = budget_amount - spent_amount`.
- Dochód jest unikalny per osoba i miesiąc.

## Widoki wymagane w MVP
- `v_budget_item_totals`
- `v_budget_person_summary`
- `v_cleaning_overview`
- `v_annual_cost_history_by_year`

## Kryteria zakończenia
- Migracje wykonują się na czystej bazie.
- Constrainty blokują najważniejsze niespójności.
- Widoki zwracają oczekiwane kolumny.
