# HomeApp Web

Webowy klient HomeApp zbudowany na pełnym szablonie Minimals TypeScript 7.7.0.
Korzysta z tego samego API i tych samych kontraktów, co aplikacja mobilna.

## Uruchomienie

Z katalogu głównego monorepo:

```powershell
corepack.cmd pnpm install
corepack.cmd pnpm --filter @homeapp/web dev
```

Aplikacja jest dostępna pod adresem <http://127.0.0.1:4173/>.

W trybie development frontend łączy się z `https://app.porabkihome.pl/api`.
Build produkcyjny domyślnie używa `/api` pod domeną, z której otwarto aplikację.
Inny backend można
wskazać przed uruchomieniem przez `VITE_API_URL` w `apps/web/.env.local`:

```env
VITE_API_URL=http://127.0.0.1:3000/api
```

## Produkcja

Adres: https://app.porabkihome.pl. Kontener `web` buduje statyczną aplikację na
Node 24 i serwuje ją przez Nginx; `/api` przekazuje do kontenera `api`.
Nie uruchamiaj `vite preview` jako serwera produkcyjnego.
Docker zawsze buduje z `VITE_API_URL=/api` i nie kopiuje lokalnych plików `.env`.
Do pracy lokalnej wymagany jest Node >=22.12 i pnpm 9.15.4.

Google: `VITE_GOOGLE_CLIENT_ID` to publiczny identyfikator klienta typu Web.
Dodaj go również do listy backendu `GOOGLE_OAUTH_CLIENT_IDS` i autoryzuj origin
`https://app.porabkihome.pl` w Google Cloud. Zmiana identyfikatora wymaga
przebudowania obrazu web. Pusta wartość ukrywa przycisk Google.

Instrukcja wydania i rollbacku: [production-deploy.md](../../docs/production-deploy.md).

## Kontrole jakości

```powershell
corepack.cmd pnpm --filter @homeapp/web typecheck
corepack.cmd pnpm --filter @homeapp/web lint
corepack.cmd pnpm --filter @homeapp/web test
corepack.cmd pnpm --filter @homeapp/web build
```

Oryginalne komponenty, layouty i zasoby Minimals pozostają w `src` i `public`.
Kod integracji HomeApp znajduje się w `src/homeapp`, a aktywne trasy w
`src/routes/sections/index.tsx`.

Licencja dostarczonego szablonu: [MINIMALS-LICENSE.md](MINIMALS-LICENSE.md).
