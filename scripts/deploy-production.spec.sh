#!/usr/bin/env bash
set -euo pipefail
script=${1:?deployer path}
root=$(mktemp -d /tmp/homeapp-deploy-test.XXXXXX)
trap '[[ "$root" == /tmp/homeapp-deploy-test.* ]] && rm -rf -- "$root"' EXIT
mkdir "$root/bin"
cat > "$root/bin/docker" <<'SH'
#!/bin/bash
echo "$*" >> "$MOCK_LOG"
if [[ $1 = inspect ]]; then echo "old-image-$2"; fi
if [[ $1 = run && " $* " = *' -d '* ]]; then echo probe-container; fi
if [[ $1 = compose && " $* " = *' build web '* && ${FAIL_BUILD:-0} = 1 ]]; then exit 42; fi
SH
cat > "$root/bin/curl" <<'SH'
#!/bin/bash
echo '{"status":"ok"}'
SH
chmod +x "$root/bin/"*
export PATH="$root/bin:$PATH"

scenario() {
 local name=$1
 local dir="$root/$name"
 mkdir -p "$dir/source"
 git init --bare -q -b main "$dir/origin"
 git init -q -b main "$dir/source"
 git -C "$dir/source" config user.name Test
 git -C "$dir/source" config user.email test@example.invalid
 mkdir -p "$dir/source/apps/web" "$dir/source/scripts"
 echo initial > "$dir/source/apps/web/file"
 echo services: > "$dir/source/compose.prod.yml"
 cat > "$dir/source/scripts/smoke-web.sh" <<'SH'
#!/bin/bash
if [[ ${FAIL_VERIFY:-0} = 1 && $1 = http://127.0.0.1:3003 ]]; then exit 43; fi
SH
 git -C "$dir/source" add .
 git -C "$dir/source" commit -qm initial
 git -C "$dir/source" remote add origin "$dir/origin"
 git -C "$dir/source" push -q origin main
 git clone -q "$dir/origin" "$dir/production"
 echo 'TEST_ONLY=1' > "$dir/production/.env"
 local previous next
 previous=$(git -C "$dir/production" rev-parse HEAD)
 echo updated > "$dir/source/apps/web/file"
 git -C "$dir/source" commit -qam updated
 git -C "$dir/source" push -q origin main
 next=$(git -C "$dir/source" rev-parse HEAD)
 export HOMEAPP_REPO="$dir/production" HOMEAPP_DEPLOY_STATE="$dir/state" MOCK_LOG="$dir/docker.log"
 local result=0
 bash "$script" > "$dir/output" 2>&1 || result=$?
 if [[ $name = success ]]; then
  test "$result" = 0
  test "$(git -C "$dir/production" rev-parse HEAD)" = "$next"
  test "$(cat "$dir/state/deployed-commit")" = "$next"
  local lines
  lines=$(wc -l < "$MOCK_LOG")
  bash "$script"
  test "$(wc -l < "$MOCK_LOG")" = "$lines"
 else
  test "$result" != 0
  test "$(git -C "$dir/production" rev-parse HEAD)" = "$previous"
  test "$(git -C "$dir/production" branch --show-current)" = main
  test "$(cat "$dir/state/failed-commit")" = "$next"
  if [[ $name = build-failure ]]; then ! grep -q ' up -d ' "$MOCK_LOG"; fi
  if [[ $name = health-failure ]]; then grep -q 'tag old-image-homeapp-web-1 homeapp-web:latest' "$MOCK_LOG"; fi
  local lines
  lines=$(wc -l < "$MOCK_LOG")
  bash "$script"
  test "$(wc -l < "$MOCK_LOG")" = "$lines"
 fi
 test "$(git -C "$dir/production" worktree list --porcelain | grep -c '^worktree ')" = 1
 echo "PASS $name (checkout, containers, retry suppression and cleanup)"
}
scenario success
export FAIL_BUILD=1
scenario build-failure
unset FAIL_BUILD
export FAIL_VERIFY=1
scenario health-failure
