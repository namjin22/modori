# GSMSV 배포

모도리 운영 서버는 GSMSV VM 한 대다. 계획과 VM 사양은 `docs/gsmsv-migration.md`.

```
사용자 ─HTTPS─> Cloudflare ─Tunnel─> cloudflared(VM) ─> app:3000 ─> db(Postgres 17)
```

## VM의 /opt/modori

| 파일 | 하는 일 |
|---|---|
| `docker-compose.yml` | `db`(Postgres 17)와 `app`(modori:latest). 앱은 127.0.0.1:3000에만 열린다 |
| `.env` | 비밀 값. 권한 600. 저장소에 없다. `set-secrets.sh`로만 채운다 |
| `set-secrets.sh` | 사람이 VM에서 직접 돌린다. 값을 화면에 보이지 않게 입력받는다 |
| `deploy.sh` | 이미지 받기 → 마이그레이션 → 앱 교체 → 응답 확인 |
| `migrate-from-neon.sh` | 이관하는 날 한 번. Neon 데이터를 VM DB로 복사 |
| `backup.sh` | 매일 04:00. VM 안 7일치 + 백업용 Neon에 통째로 복원 |

## 배포 흐름

`main`에 합치면 `.github/workflows/deploy.yml`이 이미지를 만들고
`docker save | ssh`로 VM에 보낸다. VM은 메모리가 4GB라 빌드를 VM에서 하지 않는다.

Actions가 쓰는 SSH 키(`GSMSV_DEPLOY_KEY`)는 VM의 `authorized_keys`에
`command="/opt/modori/deploy.sh",restrict`로 묶여 있다. 그 키로는 셸을 열 수 없고
배포 스크립트만 돈다. 키가 새도 할 수 있는 일은 "이미지를 넣고 다시 띄우기"뿐이다.

## 자주 쓰는 명령 (VM에서)

```bash
cd /opt/modori
docker compose ps                  # 상태
docker compose logs -f --tail 100 app
docker compose restart app
bash set-secrets.sh                # 비밀 값 넣기/바꾸기 (비우면 그대로 둔다)
bash backup.sh                     # 지금 백업
systemctl list-timers modori-backup.timer
```

## 되살리기

VM 안 파일에서: `docker compose exec -T db pg_restore --clean --if-exists --no-owner -U modori -d modori < backups/<파일>.dump`

VM이 통째로 사라졌으면: 새 VM에 이 폴더를 다시 만들고, 백업용 Neon에서
`pg_dump -Fc "$BACKUP_DATABASE_URL"`로 받아 같은 명령으로 복원한다.
