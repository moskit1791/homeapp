# Widoki mobile - podstawowe

Dokument roboczy dla przebudowy UX mobile. Aktywnym repo jest `C:\Users\moski\Desktop\homeapp`.

## Kierunek wizualny

- Inspiracja: czyste, modułowe UI w stylu minimals.cc, ale bez kopiowania template.
- Ekrany mają być narzędziowe: mniej opisów marketingowych, więcej jasnych akcji i czytelnych stanów.
- Każdy moduł powinien mieć własny akcent koloru:
  - finanse: zielony / niebieski / ostrzegawczy,
  - zakupy: fioletowy,
  - kalendarz: niebieski,
  - jedzenie: żółty,
  - dom: mieszane akcenty zależne od sekcji.
- Tryb jasny i ciemny korzysta z `useAppTheme`; nie dokładamy nowych statycznych palet w ekranach.

## Auth

### Logowanie

Najważniejsze elementy:
- wyśrodkowane logo i nazwa aplikacji,
- segment `Logowanie / Rejestracja`,
- pola e-mail i hasło,
- oko do podglądu hasła,
- `Zapomniałeś?` z modalem resetu hasła,
- checkbox `Zapamiętaj mnie na tym urządzeniu`,
- przyciski Google i Apple jako widoczne wejścia OAuth,
- informacja o regulaminie i polityce prywatności.

Stany:
- domyślny,
- walidacja pól,
- loading,
- błąd API / brak sieci,
- odtwarzanie zapamiętanej sesji.

### Rejestracja

Najważniejsze elementy:
- segment na górze,
- tytuł `Załóż konto`,
- pola imię / e-mail / hasło,
- oko do podglądu hasła,
- pasek siły hasła,
- checkbox akceptacji regulaminu,
- checkbox akceptacji polityki prywatności,
- podgląd regulaminu i polityki prywatności w modalach,
- przycisk `Utwórz konto`.

Stany:
- domyślny,
- walidacja,
- loading,
- błąd,
- brak akceptacji dokumentów.

Uwagi:
- Google ma przygotowany backend i mobile AuthSession, ale pełny flow wymaga prawdziwych client ID (`GOOGLE_OAUTH_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_*`) oraz testu end-to-end.
- Apple pozostaje przyciskiem UI do późniejszej konfiguracji providerów.
- `Zapamiętaj mnie` używa `expo-secure-store`; pełne działanie na telefonie wymaga dev/release builda z natywnym modułem.
- Verify/reset obsługują deep linki `homeapp://auth`; produkcja wymaga realnego SMTP smoke testu.

## Start

- Ekran ma być pulpitem operacyjnym domu, nie listą przypadkowych kart.
- Na górze: kompaktowy hero z liczbą spraw i pigułkami statusu.
- Niżej: sekcje Finanse, Wydarzenia, Jedzenie, To-do.
- Każda pusta sekcja ma mieć prosty empty state, nie ślepy formularz.

## Finanse

- Na górze: saldo miesiąca i pasek wykorzystania budżetu.
- Metryki powinny mieć różne akcenty: dochody, budżet, wydane, zostaje.
- Formularze pozostają, ale są traktowane jako narzędzia pod konkretnymi sekcjami.
- Kwoty i archiwum muszą nadal działać na istniejących endpointach.

## Zakupy

- Wzorzec UX: szybka lista jak Listonic.
- Pierwsza akcja to wpisanie produktu, nie wypełnianie dużego formularza.
- Segmenty `Dzisiaj` i `Na później`.
- Lista rozdziela `Do kupienia` i `Kupione`.
- Zaznaczone elementy są wyszarzone i przekreślone.

## Plan

- Wzorzec UX: Google Calendar + proste notes/todo.
- Jedzenie, Kalendarz, Zadania i Notatki muszą być czytelnymi trybami, nie jednym monotonnym formularzem.
- Formularze powinny być kompaktowe i blisko listy, której dotyczą.

## Dom / Więcej

- Dom: sprzątanie, koszty roczne, dane i załączniki jako czytelne panele z własnymi akcjami.
- Więcej: członkowie, zaproszenia, uprawnienia i wylogowanie bez chaosu formularzy.
- Owner/member i brak uprawnień muszą być widoczne w stanach UI.
