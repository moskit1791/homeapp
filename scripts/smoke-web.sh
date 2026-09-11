#!/usr/bin/env bash
set -euo pipefail
base=${1:?Pass the web origin}
curl --retry 20 --retry-all-errors --retry-delay 2 --max-time 5 -fsS "$base/api/health" | grep -q '"status":"ok"'
curl --retry 10 --retry-all-errors --retry-delay 1 --max-time 5 -fsS "$base/healthz" | grep -q ok
for path in / /finanse /auth/reset-password; do
  html=$(curl --max-time 10 -fsS "$base$path")
  grep -q 'id="root"' <<<"$html"
done
asset=$(sed -n 's/.*src="\(\/assets\/[^" ]*\.js\)".*/\1/p' <<<"$html" | head -n 1)
test -n "$asset"
curl --max-time 10 -fsS "$base$asset" -o /dev/null
test "$(curl --max-time 10 -s -o /dev/null -w '%{http_code}' "$base/assets/deploy-probe-missing.js")" = 404
test "$(curl --max-time 10 -s -o /dev/null -w '%{http_code}' "$base/api/households/me")" = 401
echo "PASS web routes, health and auth boundary at $base"
