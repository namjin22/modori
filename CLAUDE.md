# 모도리 (modori)

광주소프트웨어마이스터고 학생들이 쓰는 투두 웹 서비스. 날짜별 할 일을 카테고리 색으로
기록하고, 친구를 팔로우해 완료한 할 일에 이모지로 반응한다.

이름 "모도리"는 "빈틈없이 갖춘 사람"이라는 뜻의 순우리말이다.

전체 계획과 남은 작업은 `docs/roadmap.md`, 지금까지의 설계 결정은
`docs/decisions.md`에 있다. 작업 시작 전에 둘 다 읽는다.

## 일하는 방식

- **완성 코드를 먼저 주고 설명은 짧게.** 서론 없이 결과부터.
- **냉정하게 말할 것.** 내 아이디어가 별로면 "이건 안 될 것 같다"고 그대로 말해라.
  내가 반박하고 밀고 가면 그대로 도와주되, 냉정한 피드백은 계속 유지해라.
- **추측하지 마라.** 모르면 멈추고 물어본다. 특히 API 시그니처, 파일 경로,
  외부 응답 형식은 확인 없이 지어내지 않는다.
- **에러는 그대로 보여줘라.** 우회 코드를 지어내기 전에 원문을 먼저 보고한다.
- 반말/존댓말은 상관없다.

## 스택

- **Next.js 16** (App Router) + TypeScript
- **Tailwind v4** — CSS 우선 설정. `tailwind.config.js`는 없다.
  디자인 토큰은 `app/globals.css`의 `@theme` 블록에 정의한다.
- **Prisma 6.x** + PostgreSQL 18 (GSMSV VM 안 Docker. 백업은 Neon)
- Auth.js v5 — Google + DataGSM(커스텀 OAuth)
- UI 컴포넌트는 직접 만든다(`components/`). shadcn/ui는 쓰지 않는다
- Playwright (테스트), GitHub Actions (CI·배포), GSMSV VM + Cloudflare Tunnel (운영, `deploy/README.md`)

## 버전 주의

Next.js 16과 Tailwind v4는 최신 버전이라 학습된 예제 대부분이 이전 버전(Next 15,
Tailwind v3) 기준이다.

- `tailwind.config.js`를 만들지 않는다. v4는 CSS의 `@theme`으로 설정한다.
- Next.js API 시그니처가 확실하지 않으면 추측하지 말고 물어본다.
- Prisma는 6.x 안정 버전으로 고정한다. 7.x나 8.x RC로 올리지 않는다.

## 절대 규칙

1. **테스트를 고쳐서 통과시키지 않는다.** 테스트가 실패하면 구현 코드를 고친다.
   테스트가 틀렸다고 판단되면 고치기 전에 이유를 설명하고 승인을 받는다.
2. 날짜는 전부 **Asia/Seoul** 기준. DB의 날짜 컬럼은 `@db.Date`(시각 없음).
   `new Date()`를 날짜 비교에 직접 쓰지 말고 `lib/date.ts`의 헬퍼만 쓴다.
3. **`.env`는 읽지도 수정하지도 않는다.** 시크릿이 들어 있다.
   값이 필요하면 물어본다. 새 환경 변수를 추가하면 `.env.example`에
   키 이름만 추가한다.
4. 비밀번호를 저장하는 코드를 만들지 않는다. 로그인은 OAuth만.
5. 사용자 데이터를 지우는 마이그레이션은 만들지 않는다.
   컬럼 삭제가 필요하면 먼저 물어본다.
6. 새 의존성을 추가하기 전에 먼저 물어본다.
7. **타이머, 일기, 리마인더, AI 기능은 만들지 않는다.** 이 네 가지는 모도리에서
   영구적으로 제외한다. 사용자가 명시적으로 이 규칙을 바꾸겠다고 결정하기 전에는
   UI, DB 모델, API, 설정, 문서의 작업 목록에 추가하거나 TODO로 제안하지 않는다.
8. **새 필드·새 표·새 저장소(쿠키, 로그, 외부 서비스)를 추가할 때는 개인정보 목록(`docs/privacy-inventory.md`)과
   개인정보처리방침(`lib/privacy.ts`)도 같은 커밋에서 갱신한다.** 쓰지 않을 개인정보는 저장하지 않는다.

## 폴더 구조

`src/` 디렉터리를 쓰지 않는다. 최상단에 바로 둔다.

```
app/                라우트 (App Router)
components/         UI 컴포넌트
lib/                도메인 로직 (date, routine, auth)
prisma/schema.prisma
tests/              Playwright
docs/roadmap.md     전체 계획과 남은 작업
docs/decisions.md   설계 결정 기록
docs/platforms.md   웹·데스크톱·모바일 기능 분담
docs/feedback.md    사용자 요청과 안 한 이유
docs/incidents.md   장애·버그 기록
docs/metrics.md     지표 정의와 수집 방법
docs/screenshots/   릴리스 스크린샷
```

## 명령어

```bash
npm run dev       # 개발 서버
npm run verify    # tsc --noEmit && npm run lint && 단위 테스트(시간대 3개) && playwright test
npm run build     # 프로덕션 빌드
npm run screenshots # 릴리스 스크린샷(데모 계정, docs/screenshots/)
npx prisma migrate dev --name <이름>
npx prisma studio # DB 내용 확인
```

**코드를 고친 뒤에는 항상 `npm run verify`를 돌리고, 통과 여부를 보고한다.**
"됐습니다"라고만 말하지 않는다.

## 실행 환경

Windows + Git Bash. 셸 명령은 bash 문법으로 쓴다.
`npm install`처럼 오래 걸리는 명령은 중간에 끊지 말고 끝까지 기다린다.
`npm run dev`, `npx prisma studio` 같은 블로킹 명령은 직접 실행하지 말고
나에게 실행하라고 알려준다.

## 코딩 규칙

- 주석은 "왜"만 쓴다. "무엇"은 코드가 말한다.
- 함수 하나가 화면 한 개 분량을 넘으면 쪼갠다.
- `any` 금지. 타입을 모르면 물어본다.
- 서버에서 처리할 수 있는 건 서버 컴포넌트로. `"use client"`는 상호작용이
  필요한 잎 컴포넌트에만 붙인다.
- 에러를 조용히 삼키지 않는다. `catch {}` 안이 비어 있으면 안 된다.

## 커밋 규칙

`<type>: <한글 한 줄 요약>` 형식. type은 feat / fix / chore / test / docs / refactor.
한 커밋에 한 가지 변경만. push는 내가 직접 한다.

## 설계 결정을 바꿀 때

`docs/decisions.md`에 기록된 결정과 다르게 구현해야 한다고 판단되면,
코드를 고치기 전에 먼저 이유를 설명하고 물어본다.
새로운 갈림길에서 결정을 내렸으면 같은 형식으로 `docs/decisions.md`에 추가한다.

## 기록 규칙

포트폴리오·면접의 근거가 된다. 초기 숫자와 "왜 그렇게 했는지"는 나중에 되살릴 수 없으니 그때그때 남긴다.
해당하는 일이 생기면 **같은 작업(같은 PR) 안에서** 적고, 무엇을 적었는지 최종 응답에 말한다.

| 이런 일이 생기면 | 여기에 | 적는 것 |
|---|---|---|
| 기능을 추가하거나 동작을 바꿨다 | `docs/decisions.md` | 상황 / 선택지 / 선택 / 이유 / 대가. 고르지 않은 길(선택지)과 포기한 것(대가)을 빠뜨리지 않는다. 고를 것이 없던 작은 수정(문구·간격·버그)은 적지 않는다 |
| 사용자 요청을 받았다(운영자 요청 포함) | `docs/feedback.md` | 한 줄. 반영이 아니면 **안 한 이유를 반드시**. 이름·이메일은 적지 않는다 |
| 운영에 영향이 있는 장애·버그, 배포 실패, 데이터·보안 문제가 났다 | `docs/incidents.md` | 증상 / 원인 / 조치 / 재발 방지. 증상과 시각은 겪는 동안 바로 적는다 |
| 화면이 바뀐 배포가 끝났다 | `docs/screenshots/` | `npm run screenshots`, README "릴리스 목록"에 한 줄. 운영 화면은 찍지 않는다 |
| 세는 지표를 더하거나 정의를 바꾼다 | `docs/metrics.md` | 정의와 왜 보는지, 모으는 방법. 새 저장 항목이면 개인정보 목록·방침도(규칙 8) |
| 출시, 첫 N명처럼 다시 없을 순간 | `docs/metrics.md` 이정표 | 날짜와 숫자 |

## AI 교대 작업 규칙

모도리는 Claude Pro와 Codex가 사용 가능한 한도에 따라 교대하며 개발한다. 어떤 AI가
작업을 시작하더라도 다음 규칙을 동일하게 지킨다.

- 작업 시작 전에 `docs/roadmap.md`, `docs/decisions.md`, `docs/backlog.md`,
  `docs/handoff.md`를 읽고 `git status`로 기존 변경을 확인한다.
- 다른 AI가 남긴 변경을 덮어쓰지 않는다. 같은 파일을 만질 때는 현재 상태를 먼저
  이해하고, 충돌이나 의도 변경이 있으면 `docs/handoff.md`에 기록한다.
- 작업이 한도나 외부 문제로 중단되면 현재 진행 내용, 변경 파일, 검증 결과, 실패 원인,
  다음 작업을 `docs/handoff.md`에 남긴다. 다음 AI가 별도 설명 없이 이어갈 수 있어야 한다.
- 테스트 실패를 숨기거나 테스트 자체를 고쳐 통과시키지 않는다. 실패 로그와 원인을
  기록하고 구현을 수정한다.
- `.env`와 사용자 데이터를 임의로 변경하지 않는다. 마이그레이션·삭제·새 의존성은
  기존 프로젝트 규칙과 사용자 승인을 따른다.
- 작업 종료 전 `npm run verify`를 실행하고, 통과 여부와 실행하지 못한 항목을
  `docs/handoff.md`와 최종 응답에 함께 남긴다.
