# Powiadomienia - akcje i zdarzenia

Powiadomienia push są budowane na tych samych zdarzeniach realtime, które odświeżają widoki aplikacji. Zdarzenie jest wysyłane tylko w obrębie jednego domu (`householdId`). Preferencje powiadomień są zapisywane per domownik i per typ zdarzenia w ustawieniach: **Dom -> Ustawienia i konto -> Powiadomienia**.

Użytkownik wykonujący akcję nie dostaje własnego powiadomienia push. Pozostali domownicy dostają je tylko wtedy, gdy mają włączony dany typ zdarzenia i aktywny token push.

## Typy zdarzeń

| Zdarzenie                 | Moduł         | Akcje, które je wywołują                                                                                                                                                                                                                |
| ------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `finance.changed`         | Finanse       | zmiana dochodu domownika, dodanie/edycja/usunięcie kategorii, dodanie/edycja/usunięcie pozycji budżetu, dodanie/usunięcie wydatku, dodanie/edycja/spłacenie/usunięcie pożyczki lub debetu, wygenerowanie lub usunięcie miesiąca budżetu |
| `finance.month.generated` | Finanse       | wygenerowanie kolejnego miesiąca budżetu                                                                                                                                                                                                |
| `finance.month.deleted`   | Finanse       | usunięcie miesiąca budżetu                                                                                                                                                                                                              |
| `meal.changed`            | Plan posiłków | utworzenie tygodnia, ustawienie posiłku, skopiowanie tygodnia, usunięcie tygodnia, dodanie/edycja/usunięcie inspiracji                                                                                                                  |
| `calendar.changed`        | Kalendarz     | dodanie, edycja lub usunięcie wydarzenia                                                                                                                                                                                                |
| `todo.changed`            | To-do         | dodanie, edycja, oznaczenie jako wykonane, ponowne otwarcie lub usunięcie zadania                                                                                                                                                       |
| `note.changed`            | Notatki       | dodanie, edycja lub usunięcie notatki                                                                                                                                                                                                   |
| `shopping.changed`        | Zakupy        | dodanie, edycja, usunięcie lub odhaczenie pozycji zakupów                                                                                                                                                                               |
| `cleaning.changed`        | Sprzątanie    | dodanie, edycja, usunięcie lub oznaczenie wykonania zadania sprzątania                                                                                                                                                                  |
| `annual_cost.changed`     | Koszty roczne | dodanie, edycja, usunięcie lub oznaczenie opłacenia kosztu rocznego                                                                                                                                                                     |
| `data.changed`            | Dane domowe   | dodanie, edycja lub usunięcie wpisu danych domowych                                                                                                                                                                                     |
| `attachment.changed`      | Pliki         | dodanie rekordu pliku, aktualizacja metadanych lub usunięcie pliku                                                                                                                                                                      |
| `permissions.changed`     | Uprawnienia   | zmiana uprawnień domownika                                                                                                                                                                                                              |
| `household.changed`       | Dom           | utworzenie/zmiana ustawień domu, wysłanie zaproszenia, zaakceptowanie zaproszenia, usunięcie domownika                                                                                                                                  |

## Konfiguracja użytkownika

Każdy domownik może niezależnie włączyć albo wyłączyć powiadomienia dla powyższych typów. Wyłączenie dotyczy tylko powiadomień push, nie blokuje odświeżania realtime w aplikacji.

## Lokalne przypomnienie o wydatkach z powiadomień

Import wydatków na Androidzie ma osobny mechanizm lokalny, niezależny od push i realtime:

- WorkManager planuje przypomnienie domyślnie na 21:00 czasu lokalnego,
- przypomnienie pojawia się tylko, gdy są oczekujące pozycje,
- treść zawiera wyłącznie ich liczbę,
- powiadomienie jest prywatne i nie pokazuje banku, sprzedawcy, kwoty ani waluty,
- kliknięcie otwiera `homeapp://notification-expense-import`,
- po zatwierdzeniu paczki backend publikuje jedno `finance.changed`, jeżeli utworzono co najmniej jeden wydatek.

Sam parser nie emituje push i nie wysyła treści źródłowego powiadomienia do backendu. Szczegóły: [android-notification-expense-import.md](android-notification-expense-import.md).
