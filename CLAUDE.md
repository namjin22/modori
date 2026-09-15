# 모도리 (modori)

광주소프트웨어마이스터고 학생들이 쓰는 투두 웹 서비스. 날짜별 할 일을 카테고리 색으로
기록하고, 친구를 팔로우해 완료한 할 일에 이모지로 반응한다.

이름 "모도리"는 "빈틈없이 갖춘 사람"이라는 뜻의 순우리말이다.

## 스택

- **Next.js 16** (App Router) + TypeScript
- **Tailwind v4** — CSS 우선 설정. `tailwind.config.js`는 없다.
  디자인 토큰은 `app/globals.css`의 `@theme` 블록에 정의한다.
- Auth.js v5 — Google + DataGSM(커스텀 OAuth)
- Prisma + PostgreSQL (Neon)
- shadcn/ui
- Playwright (E2E), GitHub Actions (CI), Vercel (배포)

## 버전 주의

Next.js 16과 Tailwind v4는 최신 버전이라 학습된 예제 대부분이 이전 버전(Next 15,
Tailwind v3) 기준이다. 다음을 지킨다.

- `tailwind.config.js`를 만들지 않는다. v4는 CSS의 `@theme`으로 설정한다.
- Next.js API 시그니처가 확실하지 않으면 추측하지 말고 물어본다.
- 어떤 API가 동작하지 않으면 우회 코드를 지어내지 말고, 에러 메시지를 그대로
  보고하고 멈춘다.

## 절대 규칙

1. `tests/` 아래 파일은 어떤 이유로도 수정·삭제하지 않는다.
   테스트가 실패하면 구현 코드를 고친다. 테스트를 고쳐서 통과시키는 것은 금지.
2. 날짜는 전부 **Asia/Seoul** 기준. DB의 날짜 컬럼은 `@db.Date`(시각 없음).
   `new Date()`를 날짜 비교에 직접 쓰지 말고 `lib/date.ts`의 헬퍼만 쓴다.
3. `.env`, `.env.local`은 절대 커밋하지 않는다. 새 환경 변수를 추가하면
   `.env.example`에도 키 이름만 추가한다.
4. 비밀번호를 저장하는 코드를 만들지 않는다. 로그인은 OAuth만.
5. 사용자 데이터를 지우는 마이그레이션은 만들지 않는다.
   컬럼 삭제가 필요하면 먼저 물어본다.
6. 새 의존성을 추가하기 전에 먼저 물어본다.

## 폴더 구조

`src/` 디렉터리를 쓰지 않는다. 최상단에 바로 둔다.

```
app/                라우트 (App Router)
components/         UI 컴포넌트
lib/                도메인 로직 (date, routine, auth)
prisma/schema.prisma
spec/               요구사항 문서 — 사람이 쓴다. 수정하지 않는다.
tests/e2e/          Playwright — 수정 금지
docs/decisions.md   설계 결정 기록
scripts/loop.sh     자동 반복 스크립트
```

## 명령어

```bash
npm run dev       # 개발 서버
npm run verify    # tsc --noEmit && next lint && playwright test
npm run build     # 프로덕션 빌드
npx prisma migrate dev --name <이름>
npx prisma studio # DB 내용 확인
```

작업이 끝나면 항상 `npm run verify`를 돌려서 통과하는지 확인한 뒤 보고한다.

## 실행 환경

Windows + Git Bash. 셸 명령은 bash 문법으로 쓴다.
`npm install`처럼 오래 걸리는 명령은 중간에 끊지 말고 끝까지 기다린다.

## 코딩 규칙

- 주석은 "왜"만 쓴다. "무엇"은 코드가 말한다.
- 함수 하나가 화면 한 개 분량을 넘으면 쪼갠다.
- `any` 금지. 타입을 모르면 물어본다.
- 서버에서 처리할 수 있는 건 서버 컴포넌트로. `"use client"`는 상호작용이
  필요한 잎 컴포넌트에만 붙인다.
- 에러를 조용히 삼키지 않는다. `catch {}` 안이 비어 있으면 안 된다.

## 커밋 규칙

`<type>: <한글 한 줄 요약>` 형식. type은 feat / fix / chore / test / docs / refactor.
한 커밋에 한 가지 변경만.

## 설계 결정을 바꿀 때

`docs/decisions.md`에 기록된 결정과 다르게 구현해야 한다고 판단되면,
코드를 고치기 전에 먼저 이유를 설명하고 물어본다.

## 아직 정해지지 않은 것 (임의로 채우지 말 것)

- DataGSM userinfo 응답의 실제 필드명 → 확인 전까지 `profile` 매핑을 추측하지 않는다.
- NEIS `hisTimetable`이 이 학교 데이터를 주는지 여부 → 확인 전까지 시간표 기능을 짜지 않는다.
