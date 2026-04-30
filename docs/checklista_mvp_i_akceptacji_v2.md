# Checklista MVP i akceptacji – system domowy v2

## 1. Auth i dom
- [x] rejestracja e-mail + hasło działa
- [x] logowanie e-mail + hasło działa
- [ ] logowanie Google działa
- [x] weryfikacja e-mail działa
- [x] reset hasła działa
- [x] utworzenie domu działa
- [x] zaproszenie członka działa
- [x] dołączenie członka do domu działa
- [x] owner może usunąć członka
- [x] usunięty członek traci dostęp natychmiast
- [x] banned blokuje logowanie

## 2. Uprawnienia
- [x] moduły mogą być ukryte przez brak read
- [x] read-only działa
- [x] create/update/delete są egzekwowane po stronie backendu
- [x] owner ma pełen dostęp

## 3. Finanse
- [x] istnieje jeden bieżący miesiąc
- [x] można pobrać bieżący miesiąc
- [x] można utworzyć kategorię
- [x] można utworzyć pozycję budżetową
- [x] można dodać wydatek do pozycji
- [x] spent liczy się automatycznie
- [x] remaining liczy się automatycznie
- [x] remaining może być ujemne
- [x] można wpisać dochód miesięczny osoby
- [x] podsumowanie per osoba działa
- [x] można wygenerować nowy miesiąc
- [x] nowy miesiąc kopiuje układ
- [x] nowy miesiąc nie kopiuje expenses
- [x] budżety kopiują się tylko dla kategorii z flagą
- [x] archiwum miesięcy działa
- [x] archiwalny miesiąc można otworzyć
- [x] dochodu archiwalnego nie można edytować

## 4. Jedzenie
- [x] można utworzyć tydzień planu
- [x] można wpisać posiłki do slotów
- [x] działa historia tygodni
- [x] działa kopiowanie tygodnia
- [x] działa sekcja inspiracji
- [x] działa losowanie z historii
- [x] losowanie omija ostatnie tygodnie

## 5. Kalendarz
- [x] można dodać wydarzenie
- [x] wydarzenie może być dla domu
- [x] wydarzenie może być dla osoby
- [x] działa cykliczność
- [x] najbliższe wydarzenia widać na starcie

## 6. To-do i notatki
- [x] działa tworzenie zadania
- [x] działa zmiana statusu todo/done
- [x] działa tworzenie notatki
- [x] zadania i notatki są w osobnych zakładkach

## 7. Zakupy
- [x] istnieją dwie listy: codzienne i długoterminowe
- [x] można dodać pozycję
- [x] można wpisać ilość
- [x] checkbox działa
- [x] zaznaczone spadają na dół
- [x] zaznaczone są wyszarzone

## 8. Sprzątanie
- [x] można utworzyć zadanie
- [x] można ustawić częstotliwość
- [x] można ustawić okno realizacji
- [x] complete zapisuje historię
- [x] complete wyznacza kolejny termin
- [x] zaległe są na górze listy

## 9. Koszty roczne
- [x] można utworzyć koszt roczny
- [x] można oznaczyć wykonanie
- [x] zapisuje się historia
- [x] kolejny termin wyznacza się automatycznie
- [x] historia ma filtr po roku

## 10. Dane
- [x] można dodać wpis title/value
- [x] działa wyszukiwarka
- [x] lista jest wspólna dla domu

## 11. Załączniki
- [x] można dodać zdjęcie
- [x] można dodać PDF
- [x] można ustawić podpis
- [x] działa wyszukiwarka po podpisie
- [x] storage jest prywatny

## 12. Start
- [x] pokazuje podsumowanie finansów
- [x] pokazuje wydarzenia
- [x] pokazuje plan jedzenia
- [x] układ pozostaje prosty

## 13. Realtime
- [ ] zmiany jednego użytkownika widać u drugiego
- [ ] zmiany finansów odświeżają finanse
- [ ] zmiany zakupów odświeżają zakupy
- [ ] zmiany planu odświeżają plan
- [ ] zmiany domu i uprawnień odświeżają widoczność modułów
