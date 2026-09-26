# GSMSV 이관 계획 (2026-09-25)

Vercel Hobby + Neon 무료로는 사용자 1000명을 못 버틴다(`docs/capacity.md`).
교내 IaaS인 GSMSV의 VM 한 대로 옮긴다. 이 문서는 진행하면서 고친다.

## GSMSV 조건 (사용자가 준 공식 문서 기준)

- Ubuntu 22.04 LTS VM. USER 티어 최대 `large` = vCPU 4, RAM 8GB, 디스크 50GB. VM 3개까지.
- USER VM은 만든 지 30일 뒤 만료되고, 만료 15일 전부터 연장할 수 있다. **삭제되면 복구할 수 없다.**
  사용자가 15일마다 연장하고, 나중에 PROJECT_OWNER(만료 없음)를 받을 계획이다.
- NAT 뒤에 있다. 포트 세 개가 자동으로 붙는다: SSH, HTTP(VM의 80), SVC(VM의 10000).
  외부 주소는 `http://ssh.gsmsv.site:<포트>` 평문 HTTP뿐이다. Public IP는 전체 7개 한정.
- 교육 목적에 맞지 않으면 예고 없이 삭제될 수 있다.

## 구조

```
사용자 ──HTTPS──> Cloudflare ──터널(VM에서 밖으로 연결)──> cloudflared ──> Next.js(:3000) ──> Postgres(:5432, VM 안)
```

- HTTPS는 Cloudflare Tunnel로 붙인다. VM이 Cloudflare로 나가는 연결이라 Public IP나 포트포워딩이 필요 없다.
- Next.js·Postgres·cloudflared를 Docker Compose로 띄운다.
- DB는 VM 안 Postgres(사용자 결정). Neon은 이관 뒤 **테스트·CI 전용**으로 돌린다. 테스트가 운영 DB를
  같이 쓰는 문제도 함께 풀린다.
- VM은 지금 USER가 고를 수 있는 최대인 standard(2 vCPU / 4GB / 20GB). PROJECT_OWNER를 받으면 키운다.
  메모리가 4GB라 VM에서 `next build`(2~3GB)와 Postgres·앱을 같이 돌리면 빠듯하다.
  **이미지는 GitHub Actions에서 만들어 GHCR에 올리고, VM은 받아서 띄우기만 한다.** 스왑 2GB를 둔다.

## VM (2026-09-25 생성, 확인함)

| 항목 | 값 |
|---|---|
| 노드 | GSM CPU 2 |
| OS | Ubuntu 22.04.5 LTS (커널 5.15) |
| 사양 | vCPU 2, RAM 3.8GiB, 디스크 20GB(사용 1.9GB), 스왑 없음 |
| 내부 IP | 10.0.0.133 |
| SSH | `ssh gsmsv-modori` (이 PC `~/.ssh/config`, 키 `~/.ssh/id_ed25519_gsmsv`) |
| sudo | 비밀번호 없이 됨 |
| 설치된 것 | Docker·Node 없음 |
| 바깥 연결 | Google·GitHub·npm·Cloudflare API·GHCR·Neon 모두 됨. Tunnel용 TCP 7844 열림, IPv6 안 됨 |

만료: 만든 지 30일. 만료 15일 전부터 연장 버튼이 켜진다. 사용자가 15일마다 연장한다.

## 도메인

Google 로그인은 리디렉트 주소의 도메인이 공개 접미사 목록(PSL) 기준 "최상위 개인 도메인"이어야 한다.
그래서 무료 도메인은 **상위 도메인이 PSL에 올라 있어야** 쓸 수 있다. 2026-09-25 PSL 원본에서 확인:

| 후보 | PSL | Cloudflare에 올리기 | 판단 |
|---|---|---|---|
| `modori.dpdns.org` (DigitalPlat FreeDomain) | 있음 | 네임서버 위임 가능 | **추천** |
| `modori.is-a.dev` | 있음 | GitHub PR로 신청, 레코드 제한 있음 | 대안 |
| `modori.kro.kr` 등 내도메인.한국 | **없음** | — | Google 로그인 불가 |
| `*.ts.net` (Tailscale Funnel) | 있음 | 불필요 | 주소를 고를 수 없어 제외 |

DigitalPlat은 제3자 무료 서비스라 1년마다 갱신해야 하고, 서비스가 사라질 위험이 있다.
나중에 여유가 생기면 유료 도메인으로 옮기는 편이 안전하다.

## 코드에서 바꿀 것

- `next.config`에 `output: "standalone"`, Dockerfile, `docker-compose.yml`
- Auth.js: Vercel 밖에서는 `AUTH_URL`(공개 주소)과 `AUTH_TRUST_HOST=true`가 필요하다.
  Auth.js v5 beta.32의 실제 동작을 확인한 뒤 넣는다.
- mock 로그인 가드: Vercel이 아니면 `VERCEL_ENV`가 없다. 지금 요청 호스트로 한 번 더 막고 있으니
  공개 주소에서 mock이 안 열리는지 배포 전에 확인한다.
- 배포: `main`에 합치면 VM이 새 버전을 받아 다시 띄운다(방식은 VM을 받은 뒤 정한다).
- 백업: 매일 `pg_dump`. **VM이 지워지면 VM 안의 백업도 같이 사라지므로 VM 밖으로 내보내야 한다.**

## 사용자가 할 일 (계정·비밀 값이 필요해서 대신할 수 없다)

1. ~~VM 생성~~ 완료
2. ~~SSH 키 등록~~ 완료(이 PC에서 키를 만들어 등록함)
3. 도메인: 가비아 `modori.site` 검토 중 → 사면 Cloudflare 무료 계정에 추가하고 가비아에서 네임서버를 Cloudflare로 바꾼다
4. 이관 당일: Google·DataGSM 콘솔에 새 리디렉트 주소 추가

## SSH 키

GSMSV 문서 순서 그대로다. 개인키는 이 PC 밖으로 보내지 않는다.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_gsmsv
ssh ubuntu@ssh.gsmsv.site -p <SSH 포트>          # 초기 비밀번호로 한 번 접속
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "<id_ed25519_gsmsv.pub 내용>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

이 PC의 `~/.ssh/config`에 추가:

```
Host gsmsv-modori
  HostName ssh.gsmsv.site
  Port <SSH 포트>
  User ubuntu
  IdentityFile ~/.ssh/id_ed25519_gsmsv
```

## 진행 (2026-09-26)

- 도메인: 사용자가 가비아에서 `modori.site` 1년 구매(자동 갱신 안 함 — 만료일 챙길 것).
- VM: 스왑 2GB, Docker 29 + Compose, 시간대 Asia/Seoul, cloudflared 설치.
- `/opt/modori`에 `deploy/` 파일 배치. `.env`에 DB 비밀번호·AUTH_SECRET·AUTH_URL 생성.
  Google·DataGSM·Neon 값은 아직 비어 있다(사용자가 `set-secrets.sh`로 넣는다).
- `deploy-gsmsv` 워크플로로 첫 배포 성공(PR #69). 마이그레이션 5개 적용, `/login` 200.
  아직 Tunnel이 없어 밖에서는 접속할 수 없다. 운영은 여전히 Vercel + Neon.
- 비밀번호 로그인은 사용자 결정으로 켜 둔다.

남은 순서:
1. (사용자) Cloudflare에 `modori.site` 추가 → 가비아 네임서버를 Cloudflare 것으로 변경 → Active 확인
2. (Claude) VM에서 `cloudflared tunnel login` → (사용자) 나온 주소를 브라우저로 열어 승인 → 터널·DNS 연결
3. (사용자) 백업용 Neon 프로젝트 생성, Google·DataGSM 콘솔에 `https://modori.site/api/auth/callback/...` 추가,
   VM에서 `bash /opt/modori/set-secrets.sh`로 값 입력
4. (Claude) 로그인 확인 → 이관 당일 `migrate-from-neon.sh` → 백업 타이머 켜기 → Vercel 주소에서 새 주소로 안내
