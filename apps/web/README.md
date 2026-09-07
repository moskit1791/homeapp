# HomeApp Web

Responsywna aplikacja webowa oparta wizualnie na szablonie Minimals 7.7 i korzystająca z tego samego API co aplikacja mobilna.

## Uruchomienie

```powershell
pnpm.cmd install
pnpm.cmd --filter @homeapp/web dev
```

Domyślnie aplikacja łączy się z `https://app.porabkihome.pl/api`. Inny backend można wskazać w `apps/web/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

## Zakres

- logowanie, rejestracja, zapamiętywanie i odświeżanie sesji;
- pulpit dnia;
- kalendarz;
- zakupy i spiżarnia;
- plan posiłków;
- zadania i notatki;
- budżet, zobowiązania i oszczędności;
- sprzątanie, koszty roczne i ważne dane;
- domownicy, zaproszenia i uprawnienia.

Domy z włączonym szyfrowaniem end-to-end wymagają osobnego mechanizmu odblokowania klucza w przeglądarce. Ta wersja obsługuje bezpośrednio domy bez E2EE.
