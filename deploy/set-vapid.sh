#!/usr/bin/env bash
# 웹 푸시(컴퓨터 브라우저 알림) 서버 열쇠(VAPID)를 VM에서 한 번 만든다. 비밀 열쇠는 화면에 보이지 않고 /opt/modori/.env에만 쓴다.
# 이미 있으면 그대로 둔다. 바꾸면 지금까지의 브라우저 구독으로는 보낼 수 없다(다음에 화면을 열 때 브라우저가 새 열쇠로 다시 구독한다).
# 새 열쇠는 다음 배포 때(또는 `docker compose up -d app`으로 앱을 다시 띄울 때) 적용된다.
set -euo pipefail
cd "${DEPLOY_DIR:-/opt/modori}"
ENV=.env

if grep -q '^VAPID_PRIVATE_KEY=' "$ENV"; then
  echo "VAPID 열쇠가 이미 있다. 그대로 둔다."
  exit 0
fi

# 앱 이미지의 Node로 P-256 열쇠쌍을 만든다(VM에 Node를 따로 깔지 않는다). 비밀 열쇠는 32바이트로 앞을 0으로 채운다.
keys=$(docker compose run --rm --no-deps -T app node -e '
const ecdh = require("node:crypto").createECDH("prime256v1");
ecdh.generateKeys();
const key = ecdh.getPrivateKey();
const padded = Buffer.concat([Buffer.alloc(32 - key.length), key]);
console.log("VAPID_PUBLIC_KEY=" + ecdh.getPublicKey().toString("base64url"));
console.log("VAPID_PRIVATE_KEY=" + padded.toString("base64url"));
' </dev/null)

public=$(printf '%s\n' "$keys" | sed -n 's/^VAPID_PUBLIC_KEY=//p')
private=$(printf '%s\n' "$keys" | sed -n 's/^VAPID_PRIVATE_KEY=//p')
if [ ${#public} -ne 87 ] || [ ${#private} -ne 43 ]; then
  echo "열쇠를 만들지 못했다(길이가 맞지 않는다). .env는 그대로다." >&2
  exit 1
fi

umask 077
printf "VAPID_PUBLIC_KEY='%s'\nVAPID_PRIVATE_KEY='%s'\n" "$public" "$private" >> "$ENV"
chmod 600 "$ENV"
echo "저장했다: $ENV (공개 열쇠 앞부분 ${public:0:8}…, 비밀 열쇠는 보이지 않는다)"
