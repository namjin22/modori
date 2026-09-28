# 모도리

광주소프트웨어마이스터고 학생들이 쓰는 할 일 기록 서비스입니다. https://modori.site

"모도리"는 "빈틈없이 갖춘 사람"이라는 뜻의 순우리말입니다.

## 무엇을 하나요

- 날짜별로 할 일을 적고 체크합니다. 할 일은 카테고리 안에 적고, 카테고리마다 색이 있습니다.
- 할 일을 끝내면 달력의 그날 표시가 그 카테고리 색으로 조금씩 찹니다. 달력만 봐도 어느 날 무엇을 얼마나 했는지 보입니다.
- 매일·요일·날짜마다 반복하는 일은 루틴으로 만들어 둡니다. 그날 화면을 열 때 할 일로 들어옵니다.
- 시험이나 행사처럼 체크할 일이 아닌 날은 일정으로 따로 적습니다. 시간을 정할 수 있고, 다가오는 일정에는 D-day가 붙습니다. 달력에서 일정 이름을 다른 날로 끌면 기간이 바뀝니다.
- 친구를 닉네임으로 찾아 팔로우하면 친구가 끝낸 할 일이 보입니다(공개 카테고리만). 도리 표정이나 이모지로 반응을 보낼 수 있습니다. 원하지 않는 팔로워는 끊을 수 있습니다.
- 달마다 끝낸 개수, 해낸 비율, 며칠째 이어 왔는지를 기록 화면에서 봅니다.

로그인은 Google과 DataGSM(학생·교사 계정)으로 합니다. 비밀번호는 받지 않습니다.

타이머, 일기, 리마인더, AI 기능은 넣지 않기로 했습니다. 할 일을 적고 끝내는 데만 집중합니다.

"도리"는 모도리의 고양이 캐릭터입니다. 직접 그린 SVG라 외부 저작권 표기가 필요 없습니다(`components/dori.tsx`).

## 기술

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS v4 (`app/globals.css`의 `@theme`에 디자인 값이 있고 `tailwind.config.js`는 없습니다)
- Prisma 6 + PostgreSQL 18
- Auth.js v5 (Google, DataGSM 커스텀 OAuth), 세션은 DB에 저장
- dnd-kit (할 일 순서 바꾸기)
- Vitest (단위), Playwright (E2E)
- 운영: 교내 서버 GSMSV의 VM 한 대에 Docker Compose, Cloudflare Tunnel로 HTTPS

## 로컬에서 실행하기

Node.js 24와 PostgreSQL이 필요합니다.

```bash
npm install                 # prisma generate도 같이 돈다
cp .env.example .env        # 값을 채운다(아래 표)
npx prisma migrate dev      # 스키마 적용
npm run dev                 # http://localhost:3000
```

| 이름 | 설명 |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | PostgreSQL 주소. 로컬이면 둘 다 같은 값 |
| `AUTH_SECRET` | 세션 서명 키. `openssl rand -base64 33`으로 만든다 |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth 클라이언트 |
| `DATAGSM_CLIENT_ID`, `DATAGSM_CLIENT_SECRET` | DataGSM OAuth 클라이언트. 비워 두면 DataGSM 버튼이 없다 |
| `AUTH_MODE` | `mock`이면 이메일만으로 들어가는 테스트 로그인이 생긴다. localhost에서만 열린다 |
| `MONITOR_TOKEN` | 오류 수를 세는 주소(`/api/errors/summary`)의 비밀 값. 로컬에서는 비워도 된다 |

OAuth 클라이언트 없이 화면만 보고 싶으면 `AUTH_MODE=mock`으로 두고 로그인 화면의 "테스트 로그인"을 씁니다.

## 테스트

```bash
npm run verify    # 타입 검사 → ESLint → 단위 테스트(시간대 3개) → E2E
```

- 단위 테스트는 `TZ`를 UTC, Asia/Seoul, America/New_York으로 바꿔 세 번 돕니다(`scripts/test-tz.mjs`). 날짜는 전부 한국 시간 기준이라, 서버가 어느 시간대에 있어도 결과가 같아야 합니다.
- E2E는 프로덕션 빌드를 띄우고 `AUTH_MODE=mock`으로 로그인합니다. 테스트 계정은 `@modori.test` 이메일을 쓰고 끝나면 지웁니다.
- 날짜는 `lib/date.ts`의 함수로만 다룹니다. `new Date()`를 날짜 비교에 바로 쓰지 않습니다.

## 배포

`main`에 합치면 GitHub Actions가 Docker 이미지를 만들어 VM으로 보내고, 마이그레이션을 적용한 뒤 새 버전으로 바꿉니다. 새 버전이 1분 안에 응답하지 않으면 직전 버전으로 되돌립니다.

- `develop`에서 작업하고 `main`에는 PR로 합칩니다. PR마다 `verify` 워크플로가 돕니다.
- DB는 매일 04:00에 백업합니다. VM 안에 7일, VM 밖(Neon)에 최신본 하나.
- 서버 상태(`health`)와 오류 수(`errors`)를 GitHub Actions가 주기적으로 확인하고, 문제가 있으면 워크플로가 실패해 메일이 옵니다.

VM 구성과 자주 쓰는 명령은 [`deploy/README.md`](deploy/README.md)에 있습니다.

## 폴더

```
app/          화면과 서버 액션 (App Router). (tabs) 아래가 로그인 뒤 화면
components/   UI 컴포넌트
lib/          날짜·루틴·통계·인증 같은 도메인 로직
prisma/       스키마와 마이그레이션
tests/        unit(Vitest), e2e(Playwright)
deploy/       VM에 두는 compose·배포·백업 스크립트
docs/         계획, 설계 결정, 작업 기록
```

## 문서

| 문서 | 내용 |
|---|---|
| [`docs/roadmap.md`](docs/roadmap.md) | 지금 상태, 지나온 과정, 핵심 로직 요구사항 |
| [`docs/decisions.md`](docs/decisions.md) | 설계 결정과 그 이유 |
| [`docs/backlog.md`](docs/backlog.md) | 직접 써 보며 찾은 개선점과 처리 결과 |
| [`docs/release-checklist.md`](docs/release-checklist.md) | 출시 전 확인 항목 |
| [`docs/capacity.md`](docs/capacity.md) | 용량·부하 시험 |
| [`docs/gsmsv-migration.md`](docs/gsmsv-migration.md) | Vercel·Neon에서 GSMSV로 옮긴 기록 |
| [`docs/handoff.md`](docs/handoff.md) | 날짜별 작업 기록 |

## 문의

불편한 점이나 버그는 penamjin@gmail.com으로 보내 주세요. 서비스 안에서는 마이페이지 맨 아래에 같은 주소가 있습니다.
