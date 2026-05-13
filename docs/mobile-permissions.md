# Uprawnienia aplikacji mobilnej

Aktualny zestaw uprawnień Androida dla HomeApp:

| Obszar | Uprawnienie | Po co jest potrzebne |
| --- | --- | --- |
| Powiadomienia push | `POST_NOTIFICATIONS` | Android 13+ wymaga zgody na powiadomienia lokalne i push. |
| Galeria - odczyt zdjęć | `READ_MEDIA_IMAGES` | Android 13+ wymaga zgody na wybieranie zdjęć jako załączników. |
| Galeria - odczyt starszy Android | `READ_EXTERNAL_STORAGE` | Android 12 i starsze używają starego uprawnienia do odczytu mediów. |
| Galeria - zapis starszy Android | `WRITE_EXTERNAL_STORAGE` | Android 12 i starsze mogą wymagać tego przy zapisie zdjęć do galerii. |

Expo/RN dodaje techniczne uprawnienie sieciowe (`INTERNET`) potrzebne do połączenia z API. Nie prosimy o lokalizację, mikrofon, kontakty ani kamerę, bo obecny zakres aplikacji ich nie używa.

Runtime prompt'y w aplikacji:

1. Powiadomienia: `expo-notifications` pyta o zgodę przy rejestracji tokenu push.
2. Dodawanie zdjęć: `expo-image-picker` pyta o dostęp do galerii przed wyborem zdjęcia.
3. Zapisywanie zdjęć: `expo-media-library` pyta o uprawnienie zapisu, a potem zapisuje zdjęcie bez wybierania folderu.

Uwagi:

- Pobieranie zdjęć z załączników zapisuje plik do galerii telefonu.
- Dla plików niebędących zdjęciami aplikacja zapisuje kopię do prywatnego katalogu aplikacji, bo Expo managed workflow nie daje bezpiecznego automatycznego zapisu do publicznego folderu `Downloads` bez systemowego wyboru katalogu.
