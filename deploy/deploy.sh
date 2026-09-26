#!/usr/bin/env bash
# 표준 입력으로 받은 이미지(docker save | gzip)를 넣고, DB를 올린 뒤 앱을 바꿔 띄운다.
# GitHub Actions가 `ssh ... 'bash /opt/modori/deploy.sh' < image.tar.gz`로 부른다.
set -euo pipefail
# 기본값은 운영. 되돌리기를 시험할 때만 다른 폴더·포트·이미지 이름으로 돌린다(README "배포 되돌리기 시험").
cd "${DEPLOY_DIR:-/opt/modori}"
set -a; . ./.env; set +a
IMAGE=${IMAGE:-modori}
PORT=${APP_PORT:-3000}

# 새 버전이 뜨지 않으면 되돌릴 수 있게 지금 돌고 있는 이미지를 남겨 둔다.
if docker image inspect "$IMAGE:latest" >/dev/null 2>&1; then
  docker tag "$IMAGE:latest" "$IMAGE:previous"
fi

gunzip | docker load
# 헬스체크가 통과할 때까지 기다린다. 새 VM이나 DB가 막 켜진 직후에는 바로 붙으면 마이그레이션이 실패한다.
docker compose up -d --wait db
docker compose run --rm --no-deps app node /migrate/node_modules/prisma/build/index.js migrate deploy
docker compose up -d app

# 새 버전이 실제로 응답하는지 확인한다.
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:$PORT/login; then
    echo "배포 완료"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done

echo "새 버전이 60초 안에 응답하지 않았다. 직전 이미지로 되돌린다." >&2
docker compose logs --tail 50 app >&2
# 마이그레이션은 되돌리지 않는다. 열을 더하는 식으로만 바꾸므로 직전 앱도 새 스키마에서 돈다.
if docker image inspect "$IMAGE:previous" >/dev/null 2>&1; then
  docker tag "$IMAGE:previous" "$IMAGE:latest"
  docker compose up -d app
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null http://127.0.0.1:$PORT/login; then
      echo "직전 버전으로 되돌렸다" >&2
      exit 1
    fi
    sleep 2
  done
fi
echo "직전 버전도 응답하지 않는다. 손으로 봐야 한다." >&2
exit 1
