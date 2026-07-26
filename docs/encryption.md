# Szyfrowanie w HomeApp

## Dwie niezależne warstwy

HomeApp używa dwóch osobnych mechanizmów:

1. E2EE domu chroni dane synchronizowane przez backend.
2. Android Keystore chroni lokalną kolejkę importu powiadomień na jednym urządzeniu.

Klucze nie są wymienne i nie wolno używać jednego mechanizmu jako zamiennika drugiego.

## E2EE domu

Wybrane moduły, w tym `finances`, mogą być włączone w ustawieniach szyfrowania domu. Klient:

- pobiera wersję klucza z ustawień,
- odblokowuje klucz lokalnie,
- szyfruje JSON z AAD zależnym od modułu i encji,
- wysyła ciphertext oraz `encryptionVersion`,
- odszyfrowuje odpowiedź po pobraniu.

Backend przechowuje kopertę, kontroluje wymaganą wersję klucza i nie powinien otrzymać jawnych pól chronionego modułu.

### Koperta wydatku

AAD wydatku pozostaje:

```text
homeapp:finances:expense
```

Stary payload:

```json
{ "amount": 19.99 }
```

Rozszerzony payload:

```json
{
  "amount": 24.5,
  "name": "Zakupy",
  "occurredAt": "2026-07-26T08:00:00.000Z",
  "originalAmount": 5.5,
  "originalCurrency": "EUR",
  "source": "bank_notification"
}
```

Nowy dekoder akceptuje obie wersje. Stary dekoder nadal może odczytać `amount` z rozszerzonego obiektu. Nie zmieniaj AAD ani formatu zewnętrznej koperty bez osobnej, wersjonowanej migracji.

### Rotacja

Istniejący proces migracji finansów:

- odszyfrowuje poprzednią kopertę po stronie klienta,
- szyfruje dane bieżącą wersją,
- aktualizuje `encrypted_payload` i `encryption_version`,
- zeruje lub zastępuje wrażliwe kolumny jawne placeholderem.

Rozszerzone pola wydatku muszą przejść przez ten sam proces.

## Lokalna kolejka Android

Kolejka importu używa:

- AES-256-GCM z unikalnym nonce,
- osobnego HMAC-SHA-256 dla indeksów,
- kluczy nieeksportowalnych z Android Keystore,
- AAD wiążącego ciphertext z identyfikatorem i wersją rekordu,
- reguł backupu wykluczających bazę i lokalny SecureStore.

Klucz kolejki nie jest kluczem odzyskiwania domu. Jego utrata oznacza wyłącznie utratę lokalnych, jeszcze niezatwierdzonych szkiców.

Szczegóły: [android-notification-expense-import.md](android-notification-expense-import.md).

## Zasady zmian

- Nigdy nie loguj plaintextu, klucza, nonce razem z plaintextem ani kodu odzyskiwania.
- Testuj dom z E2EE włączonym i wyłączonym.
- Każde nowe pole w zaszyfrowanej encji musi mieć bezpieczny fallback w nowym dekoderze.
- Nie usuwaj obsługi starej koperty bez jawnego planu migracji.
- Nie włączaj automatycznego resetu Room przy braku migracji.
- Nie przywracaj zaszyfrowanej bazy Android bez odpowiadającego jej klucza Keystore.
