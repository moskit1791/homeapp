# Agent API

## Cel
Zbudować modularny backend NestJS jako jedyne źródło prawdy dla danych domenowych.

## Moduły
- `DatabaseModule`
- `AuthModule`
- `UsersModule`
- `HouseholdsModule`
- `InvitationsModule`
- `PermissionsModule`
- `FinanceModule`
- `RealtimeModule`
- `MealPlannerModule`
- `CalendarModule`
- `TodoModule`
- `NotesModule`
- `ShoppingModule`
- `CleaningModule`
- `AnnualCostsModule`
- `DataEntriesModule`
- `AttachmentsModule`

## Zasady
- REST zgodny ze specyfikacją, z aktualną decyzją: bez Supabase.
- Auth obsługiwany w backendzie: hashe haseł, JWT access, opaque refresh tokeny, weryfikacja e-mail i reset hasła.
- Guard auth na endpointach prywatnych.
- Guard household i permission na każdej domenie.
- Emituj event realtime dopiero po udanym zapisie.
- Finanse implementuj przed pozostałymi modułami domenowymi.
- Storage implementuj później jako lokalny/S3-compatible moduł, bez Supabase Storage.

## Kryteria zakończenia
- API startuje lokalnie.
- Health endpoint działa.
- Moduły mają kontrolery, serwisy, DTO i walidację.
- Testy domenowe przechodzą dla finansów i permissions.
