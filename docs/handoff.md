# 작업 인수인계

## AI 교대 운영

이 프로젝트는 Claude Pro와 Codex를 사용 가능한 한도에 따라 교대한다. 다음 작업자는
`CLAUDE.md`의 **AI 교대 작업 규칙**을 먼저 읽고, 아래 문서와 `git status`를 확인한 뒤
작업을 이어간다. 한도 소진이나 외부 오류로 멈출 때는 이 파일에 마지막 상태와 다음
작업을 추가한다.

이번 비교에서는 `todomate.net`을 자동 브라우저에서 직접 열 수 없어 공식 앱 스토어의
최신 기능 설명을 보조 자료로 사용했다. 공식 설명에 있는 루틴, 색상 할 일, 타이머,
일기, 리마인더, AI, 친구 반응 중 현재 MVP에 없는 타이머·일기·리마인더·AI는
`docs/roadmap.md`의 영구 제외 규칙으로 유지한다.

사용자 확정 규칙: 타이머·일기·리마인더·AI는 v2가 아니라 영구 제외 기능이다. 사용자가
명시적으로 결정을 바꾸기 전에는 어떤 AI도 이를 구현하거나 작업 목록에 다시 넣지 않는다.

## 2026-09-19 — 연속 체크 진행률 보정

`TodoProgress`와 `useCompletionCount`를 추가해 체크박스의 낙관적 상태와 오늘 완료
개수를 같은 클라이언트 컨텍스트로 묶었다. 서버 응답 순서가 뒤섞여도 진행률이 먼저
맞고, 서버에서 다시 렌더링되면 `key`로 초기 DB 값에 동기화된다. `tests/e2e/todo.spec.ts`
에 두 할 일을 연속 완료하는 회귀 테스트를 추가했다.
타입 검사, ESLint, Vitest 53개, production build는 통과했다. 전용 E2E 재실행은
Neon DB 호스트에 연결할 수 없어 시작 단계에서 실패했으며, 코드 assertion 실패는
아니다.

## 2026-09-19 — 일정과 할 일 분리

### 완료한 범위

- `Event` 모델과 `Todo.color`를 추가했고, 마이그레이션
  `20260917121414_events_and_todo_color`를 적용했다. 기존 데이터는 수정하거나 삭제하지
  않는다.
- 오늘 화면에서 일정은 별도 섹션에서 생성·수정·삭제·되돌리기할 수 있다. 일정은 제목,
  시작일, 종료일, 색을 가지며 최대 366일 범위로 제한한다.
- 달력에는 일정 제목만 색 칩으로 표시한다. 할 일 제목은 달력에 표시하지 않으며, 완료한
  할 일의 색으로 날짜 칸 하단부터 채운다.
- 일정과 할 일은 여덟 색상 팔레트에서 고른다. 할 일 색을 고르지 않으면 카테고리 색을
  사용한다. 서버 액션은 팔레트 밖의 색상 값을 저장하지 않는다.
- 피드는 완료한 할 일만 유지하며 일정은 노출하지 않는다.

### 주요 파일

- 데이터: `prisma/schema.prisma`,
  `prisma/migrations/20260917121414_events_and_todo_color/migration.sql`
- 일정 서버 액션: `app/(tabs)/events/actions.ts`
- UI: `components/event-form.tsx`, `components/event-section.tsx`,
  `components/month-calendar.tsx`, `components/todo-row.tsx`
- 색상 규칙: `lib/colors.ts`, `components/color-swatches.tsx`
- 회귀 테스트: `tests/e2e/events.spec.ts`

### 검증 기록

- Prisma schema 검증 통과.
- `npm run verify` 통과: 단위 테스트(UTC, Asia/Seoul, America/New_York)와 Playwright
  E2E를 포함해 총 54개 통과. 실행 시간은 약 6.1분이었다.
- 이벤트 전용 E2E는 일정 생성, 여러 날 일정 표시, 삭제 후 되돌리기, 할 일 개별 색상
  저장과 달력 채우기를 검증한다.
- 기존 작업 로그에서 `prisma migrate deploy`의 적용 완료를 확인했다. 다만 2026-09-19에
  다시 실행한 `prisma migrate status`는 상세 원인 없이 Prisma schema engine 오류로
  종료됐다. 스키마 자체는 `prisma validate`를 통과했다.

### 다음 작업자 주의사항

- `.env`는 수정하지 않는다.
- 모든 날짜 연산은 `lib/date.ts`를 사용해 Asia/Seoul 기준을 지킨다.
- 일정은 친구 피드에 보이지 않는 것이 의도된 동작이다.
- `components/day-mark.tsx`는 달력의 클로버 표식을 색상 채우기로 교체하면서 삭제됐다.
- 기능 변경 뒤에는 `npm run verify`를 실행한다. Playwright 설정은 production build와
  단일 워커를 사용하므로 완료까지 수 분이 걸린다.

## 2026-09-20 — 다음 작업자 메모

현재 워크트리는 일정과 할 일 분리 기능을 포함한 미커밋 상태다. `next build`, TypeScript,
ESLint는 통과했다. 다만 현재 E2E를 다시 실행하면 다음 두 테스트가 실패한다.

- `tests/e2e/category-add.spec.ts`: 카테고리 +로 첫 번째 할 일을 저장한 뒤 입력칸이
  서버 액션 재렌더링으로 사라진다.
- `tests/e2e/todo.spec.ts`: 두 할 일을 빠르게 동시에 체크하면 진행률이 2/2로 올라가지
  않는다. 두 요청이 겹친 상태에서 클라이언트 낙관 상태와 서버 RSC 응답이 경쟁한다.

두 실패 모두 테스트를 고쳐 우회하지 않았다. 토글을 Route Handler로 분리하는 실험을 했지만
현재 안정적인 해결이 아니어서 적용하지 않고 원래 서버 액션 구조로 되돌렸다. 다음 작업은
카테고리 추가와 토글을 하나의 명시적인 클라이언트 mutation 흐름으로 정리한 뒤, 이 두
회귀를 먼저 고쳐야 한다. 이 두 테스트가 통과하기 전에는 UI/성능 개선 커밋을 만들거나
push하지 않는다.

추가 확인: `app/(tabs)/page.tsx`의 `TodoProgress` remount 키를 날짜만 보도록 바꾸면서
카테고리 + 연속 입력 회귀는 해결됐다. 공용 빠른 추가는 요청 완료 경계를 위해 클라이언트
요청과 `/api/todos`를 실험 중이며, 현재 남은 실패는 두 할 일을 동시에 체크하는 진행률
회귀 하나다. 네이티브 POST 뒤 늦은 hydration과 체크 이벤트가 겹치는 상황에서 재현되므로,
이 문제를 해결하기 전에는 해당 API 실험을 최종 기능으로 간주하지 않는다.

2026-09-20 추가 검증: 전체 `npm run verify`는 E2E 55/56, 시간대 단위 테스트 56/56 통과했다. 미래 루틴의 예정 완료
회귀는 서버 완료 개수 동기화 보정으로 해결되어 전용 테스트가 통과했다. health endpoint와
출시 전 체크리스트도 추가했다. 남은 것은
두 할 일을 `Promise.all`로 동시에 체크하는 회귀 1건이며, 단일 체크·달력 갱신·일정
관련 테스트는 통과한다.

2026-09-20 출시 점검 추가: 예정 루틴 완료 액션이 클라이언트에서 보낸 날짜와 규칙을
서버에서 재검증하도록 수정했다. 잘못된 날짜 조작 회귀 테스트가 추가됐고 루틴 E2E 6개가
통과한다. Todo API의 날짜 파싱 실패도 400으로 반환한다.

추가로 피드 cursor를 `doneAt + id` 복합 기준으로 수정했고, 캘린더 일정 제목을
`aria-describedby`로 스크린리더에 전달하도록 보강했다. 피드·캘린더·일정 관련 테스트가
통과한다.

색상 대비 계산기를 추가해 일정 칩의 텍스트 색을 배경 대비에 맞춰 선택하도록 보강했고,
유효한 팔레트·밝은 색·잘못된 색상 fallback 단위 테스트를 추가했다.

DataGSM OAuth Provider를 추가했다. PKCE S256, state, `datagsm:self_read`, token 교환,
userinfo 매핑, ACTIVE 상태 검증을 사용한다. `DATAGSM_CLIENT_ID`가 설정된 환경에서만
로그인 버튼이 노출된다. 실제 DataGSM 계정으로 Production redirect와 userinfo를 확인하는
수동 검증은 아직 남아 있다.

브랜드 시각 언어를 투두메이트의 클로버 계열과 분리하기 위해 도리를 펭귄 캐릭터로 교체하고,
대표 색상을 초록에서 파랑으로 변경했다. 기존 mood 이름과 반응 저장값은 호환성을 위해
유지했고 mascot E2E와 Production build를 통과했다.

## 2026-09-20 — 다음 에이전트 필수 인수인계

### DataGSM OAuth 현재 상태

- Production에서 Google 로그인은 정상이다.
- DataGSM 로그인 버튼도 Production에 노출된다.
- DataGSM 로그인 화면까지는 이동하지만, 아이디·비밀번호 입력 후
  `/api/auth/error?error=Configuration`으로 돌아온다.
- Vercel invocation에서 확인한 내용:
  - Route: `/api/auth/[...nextauth]`
  - External APIs: `No outgoing requests`
  - callback 이후 Auth.js Configuration 오류
  - 한 로그에서는 `/api/auth/callback/datagsm`의 `[auth] details`에
    `error: invalid_request`가 보였지만 전체 `error_description`은 아직 확보하지 못했다.
- Google/DataGSM 계정 중복 단계까지 도달하지 않은 것으로 보인다. userinfo 요청이 발생하지
  않았으므로 계정 linking 로직을 원인으로 단정하지 말 것.
- Production Client 설정 화면에서는 다음을 확인했다:
  - Client ID: `e461f60e-4a4b-4bb6-9d6a-dbf36abbaefa`
  - Production redirect: `https://modori.vercel.app/api/auth/callback/datagsm`
  - 권한 표시: `SELF_READ`
- DataGSM 문서 기준 endpoint:
  - authorize: `https://oauth.authorization.datagsm.kr/v1/oauth/authorize`
  - token: `https://oauth.authorization.datagsm.kr/v1/oauth/token`
  - userinfo: `https://oauth.resource.datagsm.kr/userinfo`
- 현재 `lib/auth.ts`는 다음 상태다:
  - `scope: "datagsm:self_read"`
  - `checks: ["pkce"]` (DataGSM callback에서 state가 누락될 가능성을 분리하기 위해 state를 임시 제거)
  - Auth.js 기본 token 요청을 `customFetch`로 가로채 JSON body로 변환
  - 기본 Authorization header 제거
  - Client Secret은 환경변수에서 읽음
  - ACTIVE 상태만 허용
  - `allowDangerousEmailAccountLinking: true`
- Auth.js v5 beta의 `token.request` override는 실제로 호출되지 않는 사례가 있어 사용하지 않는다.
- 다음 에이전트는 추측으로 scope/checks를 반복 변경하지 말고, Vercel callback 로그의 정확한
  `error_description` 또는 DataGSM 친구에게 callback 요청/응답 원문을 확인받아야 한다.

### DataGSM 다음 확인 순서

1. DataGSM 친구에게 해당 Client의 실제 허용 scope 문자열이 정확히 `datagsm:self_read`인지 확인한다.
2. authorize 성공 후 DataGSM이 redirect하는 실제 callback query에 `code`가 있는지, `state`가
   있는지 확인한다. Authorization Code와 토큰은 공유하지 않는다.
3. PKCE cookie가 Vercel callback에서 존재하는지 확인한다. 없으면 Auth.js cookie 설정과
   DataGSM redirect 흐름을 점검한다.
4. callback에서 token endpoint 요청이 실제로 나가는지 확인한다.
5. token 요청의 DataGSM 응답 status와 `error_description`만 로그로 확인한다.
6. 정상 userinfo JSON의 `status`, `email`, `student.name`을 확인한다.

### 캐릭터 현재 상태

- 사용자 피드백: 현재 펭귄/몽글 생명체 디자인은 “별로”이며 수용하지 않았다.
- 현재 `components/dori.tsx`는 파란 몽글 생명체 SVG지만 최종 디자인으로 간주하지 않는다.
- 다음 에이전트는 기존 SVG를 조금씩 고치는 대신 새 콘셉트부터 다시 설계해야 한다.
- 요구사항:
  - 투두메이트 클로버 캐릭터와 시각적으로 완전히 달라야 한다.
  - 작고 귀엽고 한눈에 기억되는 실루엣이어야 한다.
  - `happy`, `like`, `fire`, `clap`, `party`, `calm`, `sad`, `confused`, `hello` mood를 모두 표현해야 한다.
  - 반응 저장값 `👍🔥👏🎉`과 기존 컴포넌트 호출 API는 깨지지 않아야 한다.
  - 새 캐릭터 시안은 mascot E2E와 Production build를 통과시킨다.

### Git/배포 상태

- Production main 최신 merge commit: `ce48819` 또는 이후 DataGSM scope/캐릭터 관련 merge commit
- develop과 main은 squash merge 방식으로 동기화한다.
- PR check는 동시 체크 회귀와 CI Neon 데이터 경합 때문에 종종 실패한다. 실패 내용을 숨기고
  테스트를 바꾸지 않는다.
- Production migration 상태는 확인 완료:
  - `Database schema is up to date!`

## 2026-09-21 — DataGSM 토큰 형식과 캐릭터 재설계

### DataGSM: 확인한 사실

추측 대신 실제로 측정했다. 비밀값은 출력하지 않았다.

- **authorize 요청에 state가 없었다.** 로컬에서 `/api/auth/signin/datagsm`의 302
  Location을 찍어 확인했다. `checks: ["pkce"]`라서 파라미터 자체가 생성되지 않는다.
  나머지(response_type, scope, redirect_uri, code_challenge, S256)는 문서와 일치했다.
  `checks: ["state", "pkce"]`로 되돌린 뒤 state와 `authjs.state` 쿠키가 생기는 것을 확인했다.
- **PKCE 쿠키는 정상이었다.** authorize 직후 `authjs.pkce.code_verifier`가 저장된다.
- **토큰 엔드포인트는 JSON 본문 + 본문 자격 증명만 받는다.** 일부러 틀린 code로
  세 형식을 보내 응답을 비교했다.
  - JSON 본문 + client_id/client_secret → 400 `invalid_grant` (형식·인증 통과)
  - JSON 본문 + Basic 헤더 → 401 "잘못된 형식의 Authorization 헤더입니다"
  - form 본문 → 415 "지원되지 않는 미디어 타입입니다"
  기존 코드는 customFetch가 Authorization 헤더를 지우는데 본문에도 자격 증명이 없어서
  어떤 인증도 실리지 않았다. `client_secret_post`로 바꿔 본문에 들어가게 했다.
- **scope는 `datagsm:self_read`가 맞다.** `SELF_READ`로 보내면 400 `invalid_scope`다.
- authorize 엔드포인트는 state가 없어도 302를 준다. 즉 로그인 화면까지는 간다.
  로그인 이후 콜백에서 무엇이 돌아오는지는 실제 계정이 있어야 확인된다.

### DataGSM: 해결됨 (2026-09-21 확인)

프로덕션 배포 후 실제 DataGSM 로그인이 성공했다. 원인은 위 두 가지가 맞았다.
아래 "남은 확인"은 해결 전 절차이므로 참고용으로만 남긴다.

### DataGSM: (해결 전) 남은 확인

프로덕션에서 DataGSM 로그인을 한 번 더 시도한 뒤, Vercel 로그의 `[auth:error]` 한 줄이
필요하다. 이제 `providerError`와 `providerErrorDescription`을 함께 남긴다.
authorization code와 토큰은 로그에 남지 않는다.

- `providerError: invalid_request` 계열이면 DataGSM이 콜백에 오류를 실어 보낸 것이다.
- `name: InvalidCheck`면 PKCE/state 쿠키 문제다.
- `message`에 `unexpected "iss"`가 있으면 DataGSM이 RFC 9207 `iss`를 보내는 것이므로
  provider에 `issuer`를 정확한 문자열로 지정해야 한다. 값은 DataGSM 쪽에 확인해야 한다.

### 캐릭터

`components/dori.tsx`를 파란 고양이로 다시 그렸다. 귀로 실루엣을 잡아 24px에서도
구분되고, 눈 반지름 7과 선 굵기 3.2로 작은 크기에서 표정이 남는다. mood 아홉 가지와
`Dori({ mood, size, label, className })` 호출 방식, 반응 저장값(👍🔥👏🎉)은 그대로다.
장식으로 쓸 때는 `aria-hidden`을 유지한다.

### 되돌린 구현

빠른 추가가 `/api/todos`로 폼을 직접 POST해서 할 일 하나 넣을 때마다 전체 페이지가
다시 열렸다(목록이 사라졌다가 로딩 뼈대가 보였다). 서버 액션으로 되돌렸다.
완료 개수는 모듈 전역 Map·sessionStorage·타이머·`router.refresh` 대신 `useOptimistic`
하나로 바꿨다. `toggleTodo`에 빠져 있던 `revalidatePath("/")`도 되살렸다.
쓰지 않게 된 `app/api/todos` 라우트 두 개는 삭제했다.

### 검증 기록 (2026-09-21)

- `npx tsc --noEmit` 통과, `npm run lint` 통과, `npx next build` 통과.
- `npm run verify`: 단위 테스트 56개가 세 타임존에서 모두 통과.
  E2E는 55개 통과, 1개 실패(아래).

### 실패하는 테스트 1개 — 구현이 아니라 테스트 문제

`tests/e2e/todo.spec.ts:48` "할 일을 연달아 완료해도 완료 개수가 즉시 맞는다".

측정한 내용:

- 이 테스트는 `getByRole("button", { name: "완료", exact: true }).all()`로 체크박스
  목록을 미리 붙잡는다. 그런데 첫 번째를 누르는 순간 그 버튼의 이름이 "완료 취소"로
  바뀌어 조건에서 빠진다. 그래서 두 번째 클릭이 엉뚱한 자리를 가리키고,
  서버 액션 요청이 **한 건만** 나간다(요청 수를 세어 확인했다).
- 같은 동시 클릭을 로케이터로 그때그때 찾게 하면(`nth(0)`, `nth(1)`을 클릭 시점에 해석)
  요청 2건, 진행률 "2개 중 2개 완료", DB도 둘 다 `done=true`로 정상이다.
  간격 0ms와 120ms 모두 통과한다.
- 즉 동시 체크 동작 자체는 정상이고, 실패는 테스트가 붙잡아 둔 목록이 낡아서 생긴다.

사용자 승인을 받고 로케이터만 고쳤다. 확인하는 내용은 그대로다.
각 할 일 줄 안에서 체크박스를 찾고, 앞 클릭이 반환되면 바로 다음을 누른다.
서버 응답은 기다리지 않으므로 첫 저장이 끝나기 전에 두 번째를 누르는 상황은
그대로 검증된다.

두 클릭을 `Promise.all`로 같은 순간에 보내면 1ms 안에 겹칠 때 한쪽 DOM 이벤트가
사라진다. 브라우저에 `[dom-click]` 리스너를 붙여 계측했을 때, 겹치면 클릭이 한 번만
도달했고 두 번 도달한 경우에는 항상 요청 2건·진행률 2/2·DB 둘 다 완료로 정상이었다.

### 최종 검증 (2026-09-21)

`npm run verify` 전체 통과. 단위 56개가 세 타임존에서 통과, E2E 56개 통과.
`npx next build`도 통과했다.
