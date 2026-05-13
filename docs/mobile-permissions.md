# Uprawnienia aplikacji mobilnej

Aktualny zestaw uprawnien Androida dla HomeApp:

| Obszar | Uprawnienie | Po co jest potrzebne |
| --- | --- | --- |
| Powiadomienia push | `POST_NOTIFICATIONS` | Android 13+ wymaga zgody na powiadomienia lokalne i push. |
| Galeria - odczyt zdjec | `READ_MEDIA_IMAGES` | Android 13+ wymaga zgody na wybieranie zdjec jako zalacznikow. |
| Galeria - odczyt starszy Android | `READ_EXTERNAL_STORAGE` | Android 12 i starsze uzywaja starego uprawnienia do odczytu mediow. |
| Galeria - zapis starszy Android | `WRITE_EXTERNAL_STORAGE` | Android 12 i starsze moga wymagac tego przy zapisie zdjec do galerii. |

Expo/RN dodaje techniczne uprawnienie sieciowe (`INTERNET`) potrzebne do polaczenia z API. Nie prosimy o lokalizacje, mikrofon, kontakty ani kamere, bo obecny zakres aplikacji ich nie uzywa.

Runtime prompt'y w aplikacji:

1. Powiadomienia: `expo-notifications` pyta o zgode przy rejestracji tokenu push.
2. Dodawanie zdjec: `expo-image-picker` pyta o dostep do galerii przed wyborem zdjecia.
3. Zapisywanie zdjec: `expo-media-library` pyta o uprawnienie zapisu, a potem zapisuje zdjecie bez wybierania folderu.

Uwagi:

- Pobieranie zdjec z zalacznikow zapisuje plik do galerii telefonu.
- Dla plikow niebedacych zdjeciami aplikacja zapisuje kopie do prywatnego katalogu aplikacji, bo Expo managed workflow nie daje bezpiecznego automatycznego zapisu do publicznego folderu `Downloads` bez systemowego wyboru katalogu.
