#!/usr/bin/env bash
# 매일 새벽 systemd 타이머가 부른다(modori-backup.timer).
# VM이 지워지면 VM 안의 백업도 같이 사라진다. 그래서 VM 밖(백업용 Neon)에 통째로 복원해 둔다.
# VM 안에도 7일치 파일을 남긴다. 실수로 지운 데이터를 되찾을 때 쓴다.
set -euo pipefail
cd /opt/modori
set -a; . ./.env; set +a

mkdir -p backups
FILE="backups/modori-$(date +%Y%m%d-%H%M).dump"
docker compose exec -T db pg_dump -U modori -d modori -Fc > "$FILE"
find backups -name '*.dump' -mtime +7 -delete

if [ -n "${BACKUP_DATABASE_URL:-}" ]; then
  docker run --rm -i postgres:17-alpine \
    pg_restore --clean --if-exists --no-owner --no-privileges -d "$BACKUP_DATABASE_URL" < "$FILE"
  echo "백업 완료: $FILE → 백업용 Neon"
else
  echo "BACKUP_DATABASE_URL이 없어 VM 안에만 남겼다: $FILE" >&2
  exit 1
fi
