#!/usr/bin/env bash
# 표준 입력으로 받은 이미지(docker save | gzip)를 넣고, DB를 올린 뒤 앱을 바꿔 띄운다.
# GitHub Actions가 `ssh ... 'bash /opt/modori/deploy.sh' < image.tar.gz`로 부른다.
set -euo pipefail
cd /opt/modori

gunzip | docker load
docker compose up -d db
docker compose run --rm --no-deps app node node_modules/prisma/build/index.js migrate deploy
docker compose up -d app

# 새 버전이 실제로 응답하는지 확인한다. 안 되면 실패로 끝내 Actions에 빨갛게 남긴다.
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/login; then
    echo "배포 완료"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done
echo "새 버전이 60초 안에 응답하지 않았다" >&2
docker compose logs --tail 50 app >&2
exit 1
