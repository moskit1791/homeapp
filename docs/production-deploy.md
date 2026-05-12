# Production deploy

Ta instrukcja opisuje standardowy deploy API HomeApp na lokalna produkcje.
Nie commituj tu surowych hasel, tokenow Proxmox ani pliku `.env`; do deployu wystarcza lokalny klucz SSH i env na serwerze.

## Hosty i dostep

- Proxmox UI: `https://192.168.100.244:8006`
- Produkcyjny kontener/VM z aplikacja: `192.168.100.246`
- SSH user: `homeapp`
- SSH auth: klucz lokalny `C:\Users\moski\.ssh\homeapp_prod_ed25519`
- Katalog aplikacji na serwerze: `/opt/homeapp`
- Env produkcyjny na serwerze: `/opt/homeapp/.env`
- Docker Compose: `/opt/homeapp/compose.prod.yml`

Proxmox jest potrzebny tylko awaryjnie, gdy trzeba sprawdzic konfiguracje kontenera albo odzyskac dostep SSH.
Zwykly deploy idzie bezposrednio po SSH na `homeapp@192.168.100.246`.

## Szybki deploy z Windows

Z katalogu repo na komputerze:

```powershell
pnpm.cmd typecheck
pnpm.cmd test
git status --short --branch
git add .
git commit -m "Opis zmian"
git push origin forA
```

Nastepnie na produkcji:

```powershell
ssh -i "$env:USERPROFILE\.ssh\homeapp_prod_ed25519" homeapp@192.168.100.246
```

Na serwerze:

```bash
cd /opt/homeapp
git fetch origin
git checkout forA
git pull --ff-only origin forA
docker compose -f compose.prod.yml --env-file .env up -d --build
docker compose -f compose.prod.yml --env-file .env ps
curl -fsS http://127.0.0.1:3003/api/health
```

Kontener API odpala migracje DB przy starcie:

```text
pnpm --filter @homeapp/api db:migrate && node apps/api/dist/main.js
```

Dlatego przy deployu zmian backendu i SQL wystarczy przebudowac/restartowac Compose.

## Kontrola po deployu

Na serwerze:

```bash
docker compose -f compose.prod.yml --env-file .env logs --tail=100 api
curl -fsS http://127.0.0.1:3003/api/health
```

Z komputera lokalnego, jesli tunel/domena jest aktywna:

```powershell
Invoke-RestMethod https://app.porabkihome.pl/api/health
```

Oczekiwany wynik healthchecka:

```json
{"status":"ok","service":"homeapp-api"}
```

## Gdzie trzymac sekrety

- `/opt/homeapp/.env` na produkcji zawiera sekrety API, DB, SMTP i OAuth.
- `C:\Users\moski\.ssh\homeapp_prod_ed25519` daje dostep SSH do produkcji.
- Lokalne notatki z tokenami lub haslami trzymaj w plikach pasujacych do `deploy/*.local.*`, bo sa ignorowane przez git.
- Nie dodawaj do commita tokenow Proxmox, hasel ani prywatnych kluczy.
