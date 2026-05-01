# UX redesign research - 2026-05-01

## Wniosek

Obecny uklad HomeApp ma za duzo rownorzednych miejsc i zbyt wiele kart/formularzy w tresci. Funkcjonalnie kierunek jest dobry, ale interfejs powinien byc przebudowany na:

- 5 glownych zakladek maksymalnie,
- jeden dominujacy kontekst akcji na ekran,
- sekcje danych jako listy/panele, nie ciagi formularzy,
- formularze jako bottom sheets,
- wiecej koloru przez statusy i akcenty modulow, a nie przez losowe dekoracje.

## Zrodla i obserwacje

### Material/Android

- Android opisuje bottom navigation jako glowna nawigacje dla kompaktowych ekranow, a navigation rail dla wiekszych ekranow.
- Android wskazuje, ze akcje powinny byc w top barze, FAB albo menu; najwazniejsza akcja moze byc FAB/extended FAB, ale tylko jedna na tym poziomie.
- Akcje dodatkowe powinny byc w top barze albo przy powiazanej tresci, a rzadkie w overflow menu.

Zrodla:

- https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns
- https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation
- https://m1.material.io/components/buttons-floating-action-button.html

### Minimal UI / minimals.cc

- Minimal UI opiera dashboard o osobny layout, przewidywalny header, konfiguracje nav i stala siatke spacingu.
- Wniosek dla React Native: zamiast wielu niezaleznych ekranow-kart potrzebujemy jednego "application shell" i bardziej zwartej hierarchii.

Zrodlo:

- https://docs.minimals.cc/layout/

### Todoist / aplikacje zadaniowe

- Todoist uzywa dynamicznego dodawania w kontekscie listy. Najwazniejsze jest to, ze dodawanie jest powiazane z miejscem, w ktorym uzytkownik pracuje, a nie z osobnym formularzowym ekranem.

Zrodlo:

- https://www.todoist.com/help/articles/use-the-dynamic-add-button-in-todoist-ysybl2M1

## Decyzje dla HomeApp

### Nawigacja

Docelowo:

- `Start` - dzisiaj, alerty, podsumowania i skroty.
- `Finanse` - budzet, wydatki, miesiac.
- `Plan` - jedzenie, kalendarz, zadania, notatki.
- `Zakupy` - lista dzienna i dlugoterminowa.
- `Dom` - sprzatanie, koszty, dane, pliki.
- `Menu` - nie jako bottom tab; otwierane z naglowka, zawiera konto, czlonkow, uprawnienia i ustawienia.

Pierwszy wdrozony krok: ukrycie `Wiecej` z dolnej nawigacji i dodanie `Menu` w naglowku Startu.

### Akcje

- Na ekranie moze byc jeden glowny przycisk `+ Dodaj`.
- Jesli ekran ma kilka typow dodawania, `+ Dodaj` otwiera bottom sheet z 3-6 konkretnymi akcjami.
- Nie robimy wielu rownorzednych przyciskow w kazdej karcie, jezeli mozna je zgrupowac w jednej akcji ekranu.

### Dane

- Pierwszy widok sekcji pokazuje stan: lista, puste stany, metryki, alerty.
- Formularze nie sa stalym elementem widoku.
- Listy powinny byc bardziej "aplikacyjne": sekcje, statusy, ikony, swipe/menu w kolejnych iteracjach.

## Kolejne kroki

1. Zrobic jeden wspolny `QuickAddSheet` dla Start/Finanse/Plan/Zakupy/Dom.
2. Przebudowac `Start` jako centrum: "Dzisiaj", "Do zrobienia", "Finanse", "Nadchodzace", "Skroty".
3. Usprawnic bottom navigation wizualnie: 5 ikon, wieksze touch targety, brak szostego taba.
4. Zagescic karty i listy, zeby mniej przewijac.
5. Dopracowac ciemny/jasny tryb oraz semantyczne akcenty modulow.
