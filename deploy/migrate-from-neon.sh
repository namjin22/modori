#!/usr/bin/env bash
# Vercel+Neon에서 VM으로 옮기는 날 한 번 돌린다. Neon의 데이터를 VM Postgres로 그대로 복사한다.
# 돌리는 동안 Vercel 쪽에 새로 쓰인 것은 따라오지 않는다. 옮기기 직전에 돌리고 바로 주소를 바꾼다.
set -euo pipefail
cd /opt/modori
mkdir -p backups
set -a; . ./.env; set +a
: "${OLD_NEON_URL:?.env에 OLD_NEON_URL이 없다. set-secrets.sh로 넣는다}"

docker compose up -d db
until docker compose exec -T db pg_isready -U modori -d modori >/dev/null; do sleep 1; done

docker run --rm postgres:17-alpine pg_dump -Fc --no-owner --no-privileges "$OLD_NEON_URL" > backups/neon-before-move.dump
docker compose exec -T db pg_restore --clean --if-exists --no-owner --no-privileges -U modori -d modori < backups/neon-before-move.dump

docker compose exec -T db psql -U modori -d modori -c 'SELECT (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "Todo") AS todos;'
