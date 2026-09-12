# Audyt dostępności aplikacji webowej — WCAG 2.1

Data audytu: 12.09.2026

Zakres: aktywne widoki aplikacji webowej HomeApp, nawigacja, formularze, menu akcji,
stany ładowania oraz jasny i ciemny motyw.

## Wynik wdrożenia

| Kryterium WCAG 2.1 | Znalezisko | Zmiana | Stan |
| --- | --- | --- | --- |
| 1.3.1 Informacje i relacje | Rozproszone ikony akcji nie tworzyły spójnej grupy | Powtarzalne akcje elementu zostały zebrane w jedno menu z semantyką `menu` i opisanymi pozycjami | Poprawione |
| 1.4.3 Kontrast (minimum) | Tekst pomocniczy i karty miały zbyt małe wizualne rozdzielenie | Kontrast tekstu pomocniczego wynosi teraz ok. 7,7:1 w jasnym i 9,1:1 w ciemnym motywie; karty mają odrębne, nieprzezroczyste tło | Poprawione |
| 1.4.11 Kontrast elementów nietekstowych | Obramowania przycisków i kart były słabo widoczne | Wzmocniono obramowania kart oraz przycisku menu akcji w obu motywach | Poprawione |
| 2.1.1 Klawiatura | Akcje elementów muszą działać bez myszy | Menu korzysta z obsługi klawiatury MUI: Enter/Spacja otwiera, strzałki zmieniają pozycję, Escape zamyka | Poprawione |
| 2.4.1 Możliwość pominięcia bloków | Brakowało szybkiego przejścia do treści | Dodano widoczny po uzyskaniu fokusu odnośnik „Przejdź do treści” | Poprawione |
| 2.4.3 Kolejność fokusu | Menu akcji mogło wymagać przechodzenia przez kilka ikon | Każdy rekord ma jeden przycisk menu; fokus przechodzi po widocznych elementach w kolejności interfejsu | Poprawione |
| 2.4.7 Widoczny fokus | Fokus klawiatury był za słabo widoczny | Dodano globalny, kontrastowy obrys `:focus-visible` o grubości 3 px | Poprawione |
| 2.5.3 Etykieta w nazwie | Część przycisków ikonowych nie miała dostępnej nazwy | Przyciski ikonowe otrzymały `aria-label`, zgodny z działaniem widocznym lub podpowiedzią | Poprawione |
| 3.2.4 Spójna identyfikacja | Te same operacje były prezentowane w różny sposób | Wspólne menu „Akcje” obsługuje edycję, podgląd, pobieranie i usuwanie w widokach systemu | Poprawione |
| 4.1.2 Nazwa, rola, wartość | Rozwijane akcje nie miały jednolitego kontraktu dostępności | Przycisk udostępnia `aria-haspopup`, `aria-expanded` i `aria-controls`; lista ma dostępną nazwę | Poprawione |
| 4.1.3 Komunikaty o stanie | Oczekiwanie na dane nie zawsze było komunikowane | Dodano lokalne loadery z `role="status"` i `aria-live="polite"` oraz globalny pasek postępu dla pobierania i zapisywania danych | Poprawione |

## Zakres menu akcji

Jedno menu akcji zastosowano dla pozycji budżetu, kategorii, przychodów, pożyczek,
oszczędności, zadań, notatek, spiżarni, posiłków, pomysłów na posiłki, pozycji
cyklicznych, kosztów rocznych, ważnych danych, załączników, domowników i produktów
na liście zakupów. Przyciski tworzenia, nawigacji, zmiany widoku, zatwierdzania
formularza i rozwijania sekcji pozostają bezpośrednie, ponieważ mają pojedyncze,
jednoznaczne działanie.

## Weryfikacja

- kontrola typów TypeScript,
- ESLint dla całej aplikacji webowej,
- testy automatyczne aplikacji webowej,
- przegląd wszystkich wystąpień przycisków ikonowych i ich dostępnych nazw,
- obliczenie kontrastu tekstu według wzoru WCAG,
- przegląd stanów zapytań i loaderów w aktywnych widokach.

Pełna deklaracja zgodności wymaga dodatkowo ręcznego testu z czytnikiem ekranu,
powiększeniem 200–400% oraz na docelowych przeglądarkach i urządzeniach. Ten dokument
opisuje audyt kodu i wdrożone poprawki, a nie zewnętrzny certyfikat zgodności.
