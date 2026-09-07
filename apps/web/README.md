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

Domyślnie frontend łączy się z `https://app.porabkihome.pl/api`. Inny backend można
wskazać przed uruchomieniem przez `VITE_API_URL` w `apps/web/.env.local`:

```env
VITE_API_URL=http://127.0.0.1:3000/api
```

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
