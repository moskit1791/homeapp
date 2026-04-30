# Agent Mobile

## Cel
Zbudować aplikację Expo/React Native zgodną ze specyfikacją i prostym stylem inspirowanym Minimal UI.

## Nawigacja
- Dolne taby: Start, Finanse, Plan, Zakupy, Dom, Więcej.
- Finanse: Miesiąc, Archiwum.
- Plan: Jedzenie, Kalendarz, To-do, Notatki.
- Dom: Sprzątanie, Koszty roczne, Dane, Załączniki.

## Design system
- Neutralne tło i jasne powierzchnie.
- Akcent zielony `#00A76F`.
- Radius maksymalnie 8 px dla kart i kontrolek.
- Subtelne cienie, czytelna typografia, krótkie formularze.
- Listy jako podstawowy wzorzec UI.
- Ikony `lucide-react-native`.

## Dane i realtime
- TanStack Query.
- Formularze przez `react-hook-form` i Zod.
- Permission UI ukrywa moduły bez `read`.
- Brak create/update/delete blokuje akcje.
- Realtime invaliduje cache odpowiedniego modułu.

## Kryteria zakończenia
- Expo startuje.
- Ekrany renderują się bez błędów.
- Brak modułów bez `read`.
- Smoke testy podstawowych ekranów przechodzą.
