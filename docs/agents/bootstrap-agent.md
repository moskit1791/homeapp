# Agent Bootstrap/Infra

## Cel
Przygotować repozytorium, narzędzia i szkielety aplikacji tak, aby backend, mobile i pakiety współdzielone można było rozwijać etapami.

## Zakres
- `git init`.
- `pnpm` przez Corepack.
- Root config: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `.gitignore`, `.editorconfig`, `.gitattributes`.
- Pakiety: `packages/tsconfig`, `packages/eslint-config`, `packages/shared-types`, `packages/shared-validation`.
- Szkielety: `apps/api`, `apps/mobile`.
- Env examples i README.

## Decyzje
- Nie wymagaj globalnych CLI poza narzędziami systemowymi.
- Uruchamiaj projekt przez skrypty `pnpm`.
- Na tym komputerze PowerShell blokuje `pnpm.ps1`; w PowerShell używaj `pnpm.cmd`.
- Corepack nie może zapisać shimów bez uprawnień administratora, więc `pnpm` został zainstalowany w profilu użytkownika przez npm.
- Root config edytuje tylko ten agent na etapie bootstrapu.
- Lokalny PostgreSQL jest bazą developmentową.

## Kryteria zakończenia
- `pnpm install` przechodzi.
- `pnpm typecheck` przechodzi albo blokery są opisane w `docs/progress.md`.
- API ma health endpoint.
- Mobile ma minimalny ekran startowy Expo Router.
