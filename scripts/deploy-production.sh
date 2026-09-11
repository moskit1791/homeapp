#!/usr/bin/env bash
# Pull-based production deployment. Run as homeapp, never from a CI PR runner.
set -Eeuo pipefail
umask 077

main() {
  local repo=${HOMEAPP_REPO:-/opt/homeapp}
  local state=${HOMEAPP_DEPLOY_STATE:-/home/homeapp/.local/state/homeapp-deploy}
  mkdir -p "$state"
  exec 9>"$state/lock"
  flock -n 9 || exit 0
  cd "$repo"
  test "$(git branch --show-current)" = main
  git diff --quiet && git diff --cached --quiet
  git fetch --quiet origin main
  local current target
  current=$(git rev-parse HEAD)
  target=$(git rev-parse origin/main)
  test "$current" != "$target" || exit 0
  if [[ ${1:-} != --retry && -f "$state/failed-commit" && $(cat "$state/failed-commit") = "$target" ]]; then
    exit 0
  fi
  git merge-base --is-ancestor "$current" "$target"
  local stamp backup stage probe_id='' switched=0 backed_up=0
  local api_changed=0 web_changed=0
  stamp="$(date -u +%Y%m%dT%H%M%SZ)-${target:0:12}"
  backup="$repo/backups/auto-$stamp"
  stage="$state/release-$stamp"
  exec > >(tee -a "$state/$stamp.log") 2>&1
  echo "Deploying $current -> $target"
  local changes
  changes=$(git diff --name-only "$current" "$target")
  if grep -Eq '^(apps/api/|db/|packages/|package.json$|pnpm-lock.yaml$|pnpm-workspace.yaml$|tsconfig.base.json$|\.npmrc$|\.dockerignore$|compose.prod.yml$)' <<<"$changes"; then api_changed=1; fi
  if grep -Eq '^(apps/web/|apps/mobile/assets/|packages/|deploy/web.nginx.conf$|package.json$|pnpm-lock.yaml$|pnpm-workspace.yaml$|tsconfig.base.json$|\.npmrc$|\.dockerignore$|compose.prod.yml$)' <<<"$changes"; then web_changed=1; fi

  cleanup() {
    if [[ -n "$probe_id" ]]; then docker stop "$probe_id" >/dev/null 2>&1 || true; fi
    if [[ -d "$stage" ]]; then git -C "$repo" worktree remove "$stage" || true; fi
  }
  failed() {
    local code=$?
    trap - ERR
    echo "FAILED release $target (exit $code)"
    printf '%s\n' "$target" > "$state/failed-commit"
    if (( backed_up )); then
      docker tag "$(cat "$backup/web-image")" homeapp-web:latest || true
      docker tag "$(cat "$backup/api-image")" homeapp-api:latest || true
    fi
    if (( switched )); then
      echo 'Restoring previous checkout and images; database migrations are NOT reversed.'
      git -C "$repo" switch --detach "$current" || true
      if (( api_changed )); then
        docker compose --project-directory "$repo" -p homeapp -f "$repo/compose.prod.yml" --env-file "$repo/.env" up -d --no-build api || true
      fi
      docker compose --project-directory "$repo" -p homeapp -f "$repo/compose.prod.yml" --env-file "$repo/.env" up -d --no-build --no-deps web || true
      # Keep main at the restored commit so the next forward fix can deploy.
      git -C "$repo" branch -f main "$current" && git -C "$repo" switch main || true
    fi
    exit "$code"
  }
  trap cleanup EXIT
  trap failed ERR
  # Refuse builds when the host is running out of storage.
  test "$(df -Pk "$repo" | awk 'NR==2 {print $4}')" -ge 3145728
  mkdir -p "$backup"
  cp "$repo/.env" "$backup/env"
  printf '%s\n' "$current" > "$backup/commit"
  docker inspect homeapp-web-1 --format '{{.Image}}' > "$backup/web-image"
  docker inspect homeapp-api-1 --format '{{.Image}}' > "$backup/api-image"
  docker tag "$(cat "$backup/web-image")" "homeapp-web:rollback-$stamp"
  docker tag "$(cat "$backup/api-image")" "homeapp-api:rollback-$stamp"
  backed_up=1
  if (( api_changed )); then
    docker exec homeapp-db-1 pg_dump -U homeapp -d homeapp -Fc > "$backup/database.dump"
    test -s "$backup/database.dump"
  fi
  git worktree add --detach "$stage" "$target"
  local -a compose=(docker compose --project-directory "$stage" -p homeapp -f "$stage/compose.prod.yml" --env-file "$repo/.env")
  "${compose[@]}" config --quiet
  # Sequential builds keep peak memory down on the 2 GB production host.
  if (( api_changed )); then
    "${compose[@]}" build api
    docker run --rm homeapp-api pnpm --filter @homeapp/api test --maxWorkers=1 --minWorkers=1
  fi
  if (( web_changed )); then
    # The Dockerfile runs lint, tests and typecheck before bundling.
    "${compose[@]}" build web
    probe_id=$(docker run -d --rm --network homeapp_default -p 127.0.0.1:3004:80 homeapp-web)
    docker exec "$probe_id" nginx -t
    bash "$stage/scripts/smoke-web.sh" http://127.0.0.1:3004
    docker stop "$probe_id" >/dev/null
    probe_id=''
  fi
  git -C "$repo" merge --ff-only --no-stat "$target"
  switched=1
  compose=(docker compose --project-directory "$repo" -p homeapp -f "$repo/compose.prod.yml" --env-file "$repo/.env")
  if (( api_changed )); then "${compose[@]}" up -d --no-build api; fi
  if (( web_changed )); then "${compose[@]}" up -d --no-build --no-deps web; fi
  bash "$repo/scripts/smoke-web.sh" http://127.0.0.1:3003
  curl --retry 5 --retry-all-errors --retry-delay 2 --max-time 15 -fsS https://app.porabkihome.pl/api/health
  printf '%s\n' "$target" > "$state/deployed-commit"
  rm -f "$state/failed-commit"
  echo "SUCCESS deployed $target"
  cleanup
  trap - EXIT ERR
}

main "$@"
