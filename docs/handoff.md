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
