#!/usr/bin/env bash
# Isolated deploy simulation: only fixture binaries can handle docker/curl/gunzip/sleep.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
root=$(mktemp -d "${TMPDIR:-/tmp}/modori-deploy-health.XXXXXX")
trap 'rm -rf "$root"' EXIT
mkdir -p "$root/bin" "$root/deploy"
printf 'IMAGE=fixture\nAPP_PORT=3999\n' > "$root/deploy/.env"

cat > "$root/bin/mock" <<'MOCK'
#!/bin/bash
set -euo pipefail
case "${0##*/}" in
  docker)
    printf 'docker %s\n' "$*" >> "$MOCK_LOG"
    if [[ "$1 ${2:-}" == "tag fixture:previous" ]]; then
      printf 'old\n' > "$MOCK_VERSION"
    elif [[ "$1" == load ]]; then
      printf 'new\n' > "$MOCK_VERSION"
    elif [[ "$1 ${2:-}" == "image inspect" && "${3:-}" == "fixture:previous" ]]; then
      exit 0
    fi
    ;;
  curl)
    printf 'curl %s\n' "$*" >> "$MOCK_LOG"
    url=${*: -1}
    if [[ "$url" == */login ]]; then
      exit 0
    fi
    if [[ "$url" == */api/health ]]; then
      [[ "$(<"$MOCK_VERSION")" == old && "$MOCK_SCENARIO" == rollback_ok ]] && exit 0
      [[ "$(<"$MOCK_VERSION")" == new && "$MOCK_SCENARIO" == forward_ok ]] && exit 0
      exit 22
    fi
    exit 23
    ;;
  gunzip) exit 0 ;;
  sleep) exit 0 ;;
  *) exit 99 ;;
esac
MOCK
chmod +x "$root/bin/mock"
for cmd in docker curl gunzip sleep; do ln -s mock "$root/bin/$cmd"; done

run_case() {
  local scenario=$1 expected=$2 output status=0
  : > "$root/log"
  printf 'old\n' > "$root/version"
  output=$(env -i PATH="$root/bin:/usr/bin:/bin" DEPLOY_DIR="$root/deploy" \
    MOCK_LOG="$root/log" MOCK_VERSION="$root/version" MOCK_SCENARIO="$scenario" \
    /bin/bash "$repo/deploy/deploy.sh" </dev/null 2>&1) || status=$?
  if [[ "$status" != "$expected" ]] || ! grep -q 'curl .*\/api/health' "$root/log" ||
     grep -q 'curl .*\/login' "$root/log" || grep '^curl ' "$root/log" | grep -qv -- '--max-time 2'; then
    printf 'FAIL %s: exit=%s expected=%s\n%s\n' "$scenario" "$status" "$expected" "$output" >&2
    printf 'mock calls:\n%s\n' "$(<"$root/log")" >&2
    exit 1
  fi
  case "$scenario" in
    forward_ok)
      if grep -q 'docker tag fixture:previous fixture:latest' "$root/log"; then
        printf 'FAIL forward_ok: rolled back a healthy version\n' >&2; exit 1
      fi ;;
    rollback_ok)
      if ! grep -q 'docker tag fixture:previous fixture:latest' "$root/log" ||
         [[ $(grep -c 'curl .*\/api/health' "$root/log") -lt 2 ]]; then
        printf 'FAIL rollback_ok: rollback was not checked\n' >&2; exit 1
      fi ;;
    rollback_bad)
      if ! grep -q 'docker tag fixture:previous fixture:latest' "$root/log" ||
         [[ $(grep -c 'curl .*\/api/health' "$root/log") -lt 60 ]] ||
         [[ "$output" != *'직전 버전도 응답하지 않는다'* ]]; then
        printf 'FAIL rollback_bad: unhealthy rollback was accepted\n' >&2; exit 1
      fi ;;
  esac
  printf 'PASS %s (exit %s)\n' "$scenario" "$status"
}

run_case forward_ok 0
run_case rollback_ok 1
run_case rollback_bad 1
