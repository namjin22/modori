#!/usr/bin/env bash
# VM에서 사람이 직접 한 번 돌린다. Apple 로그인·iOS 푸시 키를 /opt/modori/.env에 넣고 앱을 다시 띄운다.
# 키는 화면에 남지 않게 입력받고 .env(권한 600)에만 쓴다. 이 스크립트는 값을 어디에도 보내지 않는다.
# 쓰는 법은 docs/mobile-release.md "Apple 로그인 켜기".
set -euo pipefail

DIR=${MODORI_DIR:-/opt/modori}
ENV="$DIR/.env"
touch "$ENV"
chmod 600 "$ENV"

# 작은따옴표로 감싸 쓴다(set-secrets.sh와 같은 이유: backup.sh가 bash로 이 파일을 읽는다).
set_value() {
  local key=$1 value=$2
  grep -v "^${key}=" "$ENV" > "$ENV.tmp" || true
  printf "%s='%s'\n" "$key" "$value" >> "$ENV.tmp"
  mv "$ENV.tmp" "$ENV"
  chmod 600 "$ENV"
}

ask() {
  local label=$1 value
  read -rp "$label: " value >&2
  value=${value//[[:space:]]/}
  if [ -z "$value" ]; then echo "  비어 있어요. 처음부터 다시 해 주세요." >&2; exit 1; fi
  printf '%s' "$value"
}

echo "== Apple 로그인·푸시 키 넣기 =="
APPLE_ID=$(ask "1) Services ID (예: site.modori.web)")
TEAM_ID=$(ask "2) 팀 ID (10자리)")
KEY_ID=$(ask "3) 키 ID (10자리)")

echo "4) 키 파일(.p8)을 메모장으로 열어 내용 전체를 복사해 여기에 붙여 넣고, 그다음 빈 줄에서 Enter를 누르세요."
KEY=""
while IFS= read -r line; do
  line=${line%$'\r'}
  [ -z "$line" ] && break
  KEY+="${line}\\n"
done
case $KEY in
  "-----BEGIN PRIVATE KEY-----"*"-----END PRIVATE KEY-----\\n") ;;
  *) echo "키 모양이 달라요. -----BEGIN PRIVATE KEY----- 로 시작해 -----END PRIVATE KEY----- 로 끝나야 해요." >&2; exit 1 ;;
esac
case $KEY in *\'*) echo "키에 작은따옴표가 있어 넣지 않았어요." >&2; exit 1 ;; esac

set_value AUTH_APPLE_ID "$APPLE_ID"
set_value APPLE_TEAM_ID "$TEAM_ID"
set_value APPLE_KEY_ID "$KEY_ID"
set_value APPLE_PRIVATE_KEY "$KEY"
echo "저장했어요: AUTH_APPLE_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY"

if [ "${MODORI_SKIP_RESTART:-}" = "1" ]; then exit 0; fi
cd "$DIR"
# restart는 .env를 다시 읽지 않는다. 컨테이너를 새로 만든다.
docker compose up -d --force-recreate app
echo "앱을 다시 띄우는 중... (20초)"
sleep 20
if curl -fsS http://127.0.0.1:3000/login | grep -q "Apple로 계속하기"; then
  echo "성공: 로그인 화면에 'Apple로 계속하기'가 보여요."
else
  echo "버튼이 안 보여요. 값이 틀렸을 수 있어요. 아래 로그를 보내 주세요:" >&2
  docker compose logs --tail 30 app | grep -i "apple" || true
  exit 1
fi
