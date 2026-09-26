#!/usr/bin/env bash
# 사람이 VM에서 직접 한 번 돌린다. 값은 화면에 보이지 않게 입력받아 /opt/modori/.env에만 쓴다.
# AUTH_SECRET·DB 비밀번호는 여기서 새로 만든다.
set -euo pipefail
ENV=/opt/modori/.env
touch "$ENV"
chmod 600 "$ENV"

set_value() {
  local key=$1 value=$2
  grep -v "^${key}=" "$ENV" > "$ENV.tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$ENV.tmp"
  mv "$ENV.tmp" "$ENV"
  chmod 600 "$ENV"
}

ask() {
  local key=$1 label=$2 value
  read -rsp "$label: " value
  echo
  if [ -z "$value" ]; then echo "  비워 두면 그대로 둔다"; return; fi
  set_value "$key" "$value"
}

grep -q '^POSTGRES_PASSWORD=' "$ENV" || set_value POSTGRES_PASSWORD "$(openssl rand -hex 24)"
grep -q '^AUTH_SECRET=' "$ENV" || set_value AUTH_SECRET "$(openssl rand -base64 33)"
set_value AUTH_URL "https://modori.site"

ask AUTH_GOOGLE_ID "Google Client ID"
ask AUTH_GOOGLE_SECRET "Google Client Secret"
ask DATAGSM_CLIENT_ID "DataGSM Client ID"
ask DATAGSM_CLIENT_SECRET "DataGSM Client Secret"
ask OLD_NEON_URL "지금 쓰는 Neon 주소(데이터 옮길 때 한 번만 씀, DIRECT_URL 값)"
ask BACKUP_DATABASE_URL "백업용 새 Neon 프로젝트 주소"

echo "저장했다: $ENV"
cut -d= -f1 "$ENV" | sed 's/^/  - /'
