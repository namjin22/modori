#!/usr/bin/env bash
# 매일 새벽 systemd 타이머가 부른다(modori-backup.timer).
# VM이 지워지면 VM 안의 백업도 같이 사라진다. 그래서 VM 밖(백업용 Neon)에 통째로 복원해 둔다.
# VM 안에도 7일치 파일을 남긴다. 실수로 지운 데이터를 되찾을 때 쓴다.
set -euo pipefail
# 덤프에는 모든 사용자의 정보가 들어 있다. VM의 다른 계정이 읽지 못하게 만든다.
umask 077
cd /opt/modori
set -a; . ./.env; set +a

mkdir -p backups
FILE="backups/modori-$(date +%Y%m%d-%H%M).dump"
docker compose exec -T db pg_dump -U modori -d modori -Fc > "$FILE"
# 방침에 "백업에는 최대 7일"이라고 적었다. -mtime +7은 만 8일이 지나야 지우므로 +6으로 둔다.
find backups -name '*.dump' -mtime +6 -delete

if [ -z "${BACKUP_DATABASE_URL:-}" ]; then
  echo "BACKUP_DATABASE_URL이 없어 VM 안에만 남겼다: $FILE" >&2
  exit 1
fi

# 백업용 Neon은 public 스키마를 통째로 비우고 덤프로 다시 채운다. 이전에는 pg_restore --clean으로 덮었는데,
# --clean은 덤프에 있는 표만 지운다. 운영에서 지운 표(Post·PostPhoto·PostReaction·Goal)가 Neon에 남아 User를 가리키면
# User 표를 지우지 못해 2026-10-27부터 복원이 오류를 내며 User가 옛 모양·옛 내용으로 굳었다(docs/incidents.md INC-23).
# 비우기와 채우기는 한 트랜잭션이라, 어디서든 실패하면 지난번 사본이 그대로 남는다.
# 덤프 파일은 컨테이너에 읽기 전용으로 붙인다(파이프로 넘기면 pg_restore가 파일을 앞뒤로 못 읽는다).
# 접속 주소는 인자가 아니라 환경 변수로 넘긴다(인자는 ps에 보인다).
docker run --rm -e BACKUP_DATABASE_URL -v "$PWD/$FILE:/backup.dump:ro" postgres:18-alpine sh -ec '
  pg_restore --no-owner --no-privileges -f /tmp/restore.sql /backup.dump
  psql -v ON_ERROR_STOP=1 --single-transaction -q \
    -c "DROP SCHEMA public CASCADE" -c "CREATE SCHEMA public" -f /tmp/restore.sql \
    "$BACKUP_DATABASE_URL" > /dev/null
'

# 복원이 끝까지 성공했다는 표시. /api/health/backup이 이 파일의 날짜를 본다(덤프는 복원 전에 만들어져 복원이 실패해도 새 파일이 생긴다).
touch backups/neon-restore.ok
echo "백업 완료: $FILE → 백업용 Neon"
