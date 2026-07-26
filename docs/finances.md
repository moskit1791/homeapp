# Finanse

## Model

Finanse są rozdzielone per dom i miesiąc budżetowy. Kategorie zawierają pozycje budżetu, a każda pozycja ma właściciela, kwotę budżetową i listę wydatków.

Wydatek zawiera:

- `budgetItemId`,
- dodatnią kwotę w walucie domu,
- nazwę widoczną na liście,
- źródło `manual` albo `bank_notification`,
- opcjonalny czas operacji,
- opcjonalną kwotę i walutę źródłową,
- opcjonalną kopertę E2EE.

UI wymaga nazwy przy ręcznym dodawaniu. API zachowuje kompatybilność ze starszymi klientami, dlatego nazwa w starym kontrakcie pozostaje opcjonalna i ma bezpieczny fallback przy odczycie.

## Czytelność interfejsu

Ekran finansów używa większego rozmiaru tekstu i wyraźniejszego koloru dla nazw pozycji, wydatków i kwot. Nie zwiększa dodatkowo pogrubienia; najważniejsza hierarchia wynika z koloru, rozmiaru, odstępów i kontrastu.

Historia wydatków pokazuje nazwę, czas i kwotę. Dla starych rekordów bez nazwy używany jest tekst `Wydatek`.

## Ręczne dodawanie

Endpoint:

```text
POST /api/finance/expenses
```

UI wysyła nazwę i kwotę. Przy E2EE oba pola są w kopercie `expense`, a jawna kwota techniczna ma wartość zastępczą zgodną z istniejącą architekturą.

## Import z powiadomień

Endpoint paczkowy:

```text
POST /api/finance/expenses/import
```

Każda pozycja ma losowy `sourceExternalId`. API zapisuje trwały ledger idempotencji w obrębie domu i zwraca wynik per element.

Waluta źródłowa nie jest automatycznie przeliczana. Jeżeli różni się od waluty domu, użytkownik podaje finalną kwotę budżetową. Obie wartości mogą być zachowane do późniejszej prezentacji.

Szczegółowy przepływ: [android-notification-expense-import.md](android-notification-expense-import.md).

## Uprawnienia

- odczyt widoku: `finances/read`,
- ręczne tworzenie i zatwierdzanie importu: `finances/create`,
- edycja odpowiednich elementów: `finances/update`,
- usuwanie: `finances/delete`.

Klient odświeża uprawnienie przed zatwierdzeniem importu, a backend sprawdza je niezależnie.

## Migracja bazy

`202607260001_notification_expense_import.sql`:

- dodaje nazwę i metadane źródła do `expenses`,
- pozostawia nowe kolumny starszych rekordów jako `NULL`; odczyt interpretuje je jako źródło `manual`,
- tworzy trwały ledger `expense_notification_imports`.

Migracja jest addytywna, nie wykonuje masowego backfillu ani nie usuwa istniejących kolumn lub danych. Unikalność importu jest wymuszana przez ledger w obrębie domu.

## Regresja

Przy zmianach należy sprawdzić:

- stary ręczny wydatek bez nazwy,
- nowy ręczny wydatek z nazwą,
- dom bez E2EE,
- dom z E2EE i starą kopertą `{ amount }`,
- dom z E2EE i rozszerzoną kopertą,
- batch z wynikiem per element dla błędów domenowych i atomowym rollbackiem przy błędzie infrastruktury,
- ponowienie tej samej pozycji,
- ponowienie po usunięciu zatwierdzonego wydatku,
- izolację `householdId`,
- odebranie `finances/create`.
