# Agent QA

## Cel
Pilnować jakości, testów i checklisty akceptacji MVP.

## Zakres
- Testy jednostkowe backendu dla logiki domenowej.
- Testy integracyjne auth, household i permissions.
- Smoke testy mobile.
- E2E dla najważniejszych flow.
- Aktualizacja `docs/checklista_mvp_i_akceptacji_v2.md` wyłącznie po potwierdzeniu działania.

## Priorytet testów
1. Generowanie miesiąca.
2. Kopiowanie budżetów według kategorii.
3. Liczenie `spent` i `remaining`.
4. Permission guards.
5. Auth i status konta.
6. Sprzątanie i koszty roczne.
7. Zakupy i podstawowe flow mobile.

## Kryteria zakończenia
- Każdy zamknięty punkt checklisty ma potwierdzenie w `docs/progress.md`.
- Znane luki testowe są jawnie opisane.
- Blokery środowiskowe są opisane wraz z następnym krokiem.

## Strategia testów integracyjnych po rezygnacji z Supabase

### Założenia
- Auth, refresh tokeny, status konta, kontekst domu i permissions są teraz własnością API oraz lokalnego PostgreSQL.
- Testy integracyjne nie mockują `DatabaseService`; uruchamiają API/Nest providers na osobnej bazie testowej z migracjami z `db/migrations`.
- Sekrety JWT i TTL w testach są jawne, krótkie i ustawiane przez `.env.test` albo setup Vitest.
- Testy integracyjne muszą sprzątać dane przez transakcję rollback, schema reset albo osobną bazę `homeapp_test`, żeby nie mieszać się z dev smoke flow.

### Minimalny zestaw integracyjny auth
1. `POST /auth/register` tworzy lokalnego użytkownika z hashem hasła, tokenem weryfikacji i statusem początkowym.
2. `POST /auth/login` zwraca JWT access token oraz opaque refresh token, a baza przechowuje tylko SHA-256 hash refresh tokenu.
3. Błędne hasło, nieistniejący użytkownik i konto `banned` zwracają odpowiednio `401/403`.
4. `POST /auth/refresh` konsumuje ważny refresh token, odrzuca ponowne użycie tego samego tokenu i wystawia nową sesję.
5. `POST /auth/logout` unieważnia refresh tokeny użytkownika.
6. `POST /auth/verify-email` akceptuje prawidłowy dev token i odrzuca zły token.
7. `POST /auth/forgot-password` + `POST /auth/reset-password` pozwala ustawić nowe hasło i odrzuca stary reset token.
8. `POST /auth/google` pozostaje `501`, dopóki nie ma konfiguracji Google OAuth.

### Minimalny zestaw integracyjny household
1. Użytkownik z Bearer JWT może utworzyć dokładnie jeden aktywny dom.
2. Tworzenie domu zakłada owner membership, aktywuje konto nieaktywne i tworzy domyślne listy zakupów.
3. Guard household context odrzuca użytkownika bez aktywnego domu.
4. `GET/PATCH /households/me` działa tylko w kontekście aktywnego członkostwa.
5. Lista członków pokazuje aktywnych członków bieżącego domu i nie wycieka danych innego domu.
6. Zaproszenie zapisuje token i termin ważności.
7. Usunięcie członka dezaktywuje membera, ale nie pozwala usunąć ownera.

### Minimalny zestaw integracyjny permissions
1. Owner przechodzi wszystkie permission guarded endpointy bez wpisów w `member_permissions`.
2. Member bez wpisu permission dostaje `403`.
3. Member z `can_read=true` przechodzi akcję `read`, ale nie przechodzi `create/update/delete`.
4. `PATCH /households/members/:id/permissions` robi upsert i kolejne wywołanie nadpisuje poprzednie flagi.
5. Edycja permissions ownera zwraca błąd.
6. Permissions są izolowane per `household_member_id`; członek innego domu nie może dostać dostępu przez cudzy wpis.

### Kolejność wdrożenia testów
1. Dodać setup testowej bazy: tworzenie `homeapp_test`, migracje, reset danych i zmienne `JWT_*`.
2. Dodać helpery `registerAndLogin`, `createHousehold`, `insertMember`, `authHeader`.
3. Pokryć auth session lifecycle, bo to brama dla reszty API.
4. Pokryć household context i owner/member boundaries.
5. Pokryć permission guard na jednym małym endpointzie testowym albo istniejących endpointach household permissions.

### Lekkie testy jednostkowe bez bazy
- `AuthService.verifyAccessToken` sprawdza lokalny JWT: poprawny token, zły sekret i zły typ payloadu.
- `PermissionGuard` sprawdza brak wymagania, bypass ownera, decyzję dla membera i brak household context.
