# Zasady pracy agentów HomeApp

## Źródła prawdy
- `docs/specyfikacja_systemu_domowego_codex_v2.md`
- `docs/instrukcja_realizacji_dla_codex_v2.md`
- `docs/checklista_mvp_i_akceptacji_v2.md`
- `docs/progress.md`

## Kolejność pracy
1. Bootstrap repozytorium i środowiska.
2. Baza danych i migracje.
3. Auth, użytkownicy, dom i zaproszenia.
4. Uprawnienia i guardy.
5. Finanse jako pierwszy pełny moduł.
6. Pozostałe moduły domenowe.
7. Dashboard Start, realtime, mobile polish i testy.

## Zasady wspólne
- Nie dodawaj funkcji spoza MVP.
- Nie zmieniaj logiki finansów i generowania miesiąca.
- Każde zapytanie domenowe filtruj po `household_id`.
- Backend egzekwuje uprawnienia; frontend tylko ukrywa moduły i akcje pomocniczo.
- Po zakończeniu etapu zaktualizuj `docs/progress.md`.
- Checklistę akceptacji zaznaczaj tylko po realnym spełnieniu warunku.

## Format raportu etapu
- Etap i agent.
- Zakres wykonany.
- Pliki utworzone lub zmienione.
- Decyzje wykonawcze.
- Testy i wynik.
- Checklist items zaznaczone lub celowo niezaznaczone.
- Blokery.
- Następny krok.

## Ograniczenia MVP
- Bez quick add.
- Bez powiadomień.
- Bez PIN/biometrii.
- Bez AI.
- Bez offline mode.
- Bez osobnego modułu rachunków.
- Bez kategorii zakupów.
- Bez załączników przypiętych do wydatków.
