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

## 겪은 문제

- **컨테이너에서 밖으로 나가는 TLS 연결이 멈춘다** (2026-09-27): VM의 `eth0` MTU가 1400인데 Docker는
  1500을 쓴다. 작은 응답(Google 404)은 오가지만 Postgres TLS처럼 큰 패킷은 버려져 연결이 멈췄다.
  `/etc/docker/daemon.json`에 `{ "mtu": 1400 }`, compose 기본 네트워크에도 같은 값을 넣었다.
  VM을 새로 만들면 daemon.json부터 넣는다.
- **`cloudflared tunnel login`은 링크를 연 뒤 약 8분 안에 승인해야 한다.** 늦으면 인증서를 못 받는다.

## 배포 되돌리기 시험

`deploy.sh`는 새 버전이 60초 안에 `/login`에 응답하지 않으면 직전 이미지(`modori:previous`)로 되돌리고 실패로 끝난다.
마이그레이션은 되돌리지 않는다(열을 더하는 식으로만 바꾸므로 직전 앱도 돈다).

운영을 멈추지 않고 시험하려면 폴더·포트·이미지 이름을 바꿔 돌린다. 2026-09-27에 이렇게 확인했다.

```bash
T=/tmp/deploytest; mkdir -p $T; cp deploy.sh docker-compose.yml $T/
printf "POSTGRES_PASSWORD='x'
AUTH_SECRET='x'
AUTH_TRUST_HOST='true'
IMAGE='modoritest'
APP_PORT='3999'
" > $T/.env
docker tag modori:latest modoritest:latest
docker save modoritest:latest | gzip | DEPLOY_DIR=$T bash $T/deploy.sh      # 배포 완료
# 켜자마자 죽는 이미지를 파일로 만든 뒤(로컬 latest는 정상 버전으로 되돌려 두고) 넣으면 → 직전 버전으로 되돌렸다
cd $T && docker compose down -v; docker rmi modoritest:latest modoritest:previous
```

## VM 운영 설정 (deploy/ 밖, VM에 직접)

| 설정 | 위치 | 이유 |
|---|---|---|
| Docker MTU 1400, 로그 10MB×3 | `/etc/docker/daemon.json` | MTU는 "겪은 문제", 로그는 디스크(20GB) 보호 |
| 스왑 2GB | `/swapfile` | 메모리 4GB |
| 보안 업데이트 후 필요하면 05:00 자동 재부팅 | `/etc/apt/apt.conf.d/52modori-auto-reboot` | 커널·libc 업데이트는 재부팅해야 적용된다 |
| cloudflared 설정 | `/etc/cloudflared/config.yml` | 터널 `modori`, http2 |
| 백업 타이머 | `/etc/systemd/system/modori-backup.*` | 매일 04:00 |

재부팅 시험(2026-09-27 06:00): 재부팅 명령 뒤 33초 만에 `https://modori.site/api/health` 200.
docker·cloudflared·백업 타이머 모두 자동 시작, 앱·DB는 `restart: unless-stopped`로 다시 뜬다.
