# Akcje wywołujące powiadomienia

Powiadomienia push są wysyłane do domowników, którzy mają włączony dany typ w `Dom -> Ustawienia i konto -> Powiadomienia push`.

## Zmiany realtime

- `calendar.changed`: dodanie, edycja lub usunięcie wydarzenia w kalendarzu.
- `finance.changed`: zmiany w finansach, w tym dochody, kategorie, pozycje budżetu, wydatki i pożyczki/debety.
- `finance.month.generated`: wygenerowanie albo utworzenie nowego miesiąca budżetu.
- `finance.month.deleted`: usunięcie miesiąca budżetu.
- `shopping.changed`: dodanie, odhaczenie, odznaczenie, przeniesienie, wyczyszczenie lub usunięcie produktu z list zakupów.
- `meal.changed`: utworzenie tygodnia posiłków lub zapis posiłku w tygodniu.
- `todo.changed`: dodanie, wykonanie, przywrócenie lub usunięcie zadania.
- `note.changed`: dodanie, edycja lub usunięcie notatki.
- `cleaning.changed`: dodanie zadania sprzątania albo oznaczenie go jako wykonane.
- `annual_cost.changed`: dodanie kosztu rocznego albo oznaczenie go jako opłacony.
- `attachment.changed`: dodanie, edycja opisu/nazwy albo usunięcie załącznika.
- `data.changed`: dodanie albo usunięcie wpisu danych domowych.
- `household.changed`: zmiana ustawień domu albo zaproszenie/usunięcie domownika.
- `permissions.changed`: zmiana uprawnień domownika.

## Przypomnienia

- Wydarzenia kalendarza mają osobne przypomnienie per wydarzenie: brak, 15 minut, 1 godzina albo dzień wcześniej.
- Domyślne przypomnienie przy nowym wydarzeniu to dzień wcześniej.
- Przypomnienie jest niezależne od powiadomień o samej zmianie wydarzenia.

## Centrum powiadomień

- Dzwonek w `Dzisiaj` świeci tylko wtedy, gdy telefon ma lokalnie zapisane nieodczytane powiadomienia.
- Wejście w centrum powiadomień oznacza widoczne wpisy jako odczytane.
- Wyczyszczenie centrum zapisuje lokalnie usunięte identyfikatory, żeby te same wpisy nie wracały po ponownym wejściu.
