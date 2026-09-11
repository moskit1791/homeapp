# Automatyczne wdrażanie z GitHuba

Serwer produkcyjny sam sprawdza `origin/main` co dwie minuty. Wystarczy scalić
zmiany do `main` na GitHubie; komputer użytkownika nie musi być w sieci domowej.
Nie otwieramy portu SSH w Internecie ani nie instalujemy runnera PR na produkcji.

`homeapp-deploy.timer` uruchamia `scripts/deploy-production.sh` jako `homeapp`.
Skrypt używa istniejącego dostępu SSH serwera do repozytorium. Blokada `flock`
zapobiega równoczesnym wdrożeniom. Budowanie odbywa się w osobnym worktree;
działająca wersja jest przełączana dopiero po poprawnym buildzie i testach.
Zmiany samego weba nie restartują API ani bazy. Zmiany dokumentacji nie wymagają
przebudowania obrazów. Web ma lint, testy i typecheck w Dockerfile; API uruchamia
testy w nowym obrazie. Nginx i routing są sprawdzane na prywatnym porcie 3004.

Przed wydaniem zapisywane są SHA i obrazy poprzedniej wersji oraz kopia `.env`.
Przy zmianach backendu powstaje również backup bazy. Nieudana kontrola po
przełączeniu przywraca poprzedni kod i obrazy; **nie cofa migracji bazy**.
Migracje scalane do `main` muszą być zgodne z poprzednią wersją API, inaczej
rollback wymaga świadomej obsługi bazy. Skrypt odrzuca nieliniową zmianę historii
`main`, lokalne zmiany śledzonych plików i budowanie przy mniej niż 3 GB miejsca.

## Instalacja / aktualizacja jednostek

Po pierwszym wdrożeniu skryptów na serwerze:

```bash
sudo install -m 644 /opt/homeapp/deploy/homeapp-deploy.service /etc/systemd/system/homeapp-deploy.service
sudo install -m 644 /opt/homeapp/deploy/homeapp-deploy.timer /etc/systemd/system/homeapp-deploy.timer
sudo systemctl daemon-reload
sudo systemctl enable --now homeapp-deploy.timer
sudo systemctl start homeapp-deploy.service
```

Zmiany samych skryptów pobierane są wraz z kodem. Zmiana definicji jednostek
systemd wymaga ponownego wykonania powyższych komend instalacyjnych.

## Kontrola i odzyskiwanie

```bash
systemctl list-timers homeapp-deploy.timer
systemctl status homeapp-deploy.service
journalctl -u homeapp-deploy.service -n 100 --no-pager
cat /home/homeapp/.local/state/homeapp-deploy/deployed-commit
```

Logi poszczególnych wdrożeń: `/home/homeapp/.local/state/homeapp-deploy/*.log`.
Kopie: `/opt/homeapp/backups/auto-*`; obrazy mają tag `rollback-<data>-<SHA>`.
Kopie i stare obrazy należy usuwać dopiero po potwierdzeniu poprawności wydania;
skrypt nie usuwa ich automatycznie. Kontroluj wolne miejsce na serwerze.

Nieudany SHA jest zapisany w `failed-commit` i nie jest budowany w kółko.
Nowy commit na `main` uruchomi kolejną próbę. Po usunięciu awarii środowiska
można ponowić ten sam commit ręcznie:

```bash
bash /opt/homeapp/scripts/deploy-production.sh --retry
```

Zatrzymanie kolejnych wdrożeń: `sudo systemctl disable --now homeapp-deploy.timer`.
Nie zatrzymuje to aktualnie trwającego wydania. Awaryjne przerwanie aktywnego
wydania wymaga sprawdzenia stanu kontenerów i logu przed następną próbą.

Zmiany sekretów `.env` i konfiguracji Google Cloud są osobne od zmian kodu;
sam zapis `.env` nie uruchamia wdrożenia. Timer nie publikuje APK.
