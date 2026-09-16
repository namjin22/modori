# 모도리 로드맵

새 세션을 시작할 때 이 문서와 `docs/decisions.md`를 먼저 읽는다.

---

## 현재 상태 (2026-09-16)

**완료**
- Next.js 16 프로젝트 생성, GitHub 연결, Vercel 배포 (https://modori.vercel.app)
- 자동 배포 파이프라인 동작 확인 (main에 push하면 재배포)
- Neon Postgres 프로젝트 생성, `.env`에 DATABASE_URL / DIRECT_URL 작성
- `prisma/schema.prisma` 배치, `.env.example`, `.gitignore` 정리
- `package.json`에 `postinstall`, `verify` 스크립트 추가
- **Day 2** — Prisma CLI/client를 6.19.3으로 고정, `migrate dev --name init` 적용,
  `lib/prisma.ts` 싱글톤
- **Day 3** — `lib/date.ts`, `lib/routine.ts`와 유닛 테스트 37개 (vitest,
  `scripts/test-tz.mjs`가 세 TZ에서 반복 실행)
- **Day 4** — Auth.js v5 + Google 로그인, 닉네임 온보딩, `AUTH_MODE=mock` 우회 모드,
  Playwright E2E
- **Day 5** — 디자인 토큰(CSS 변수 + `@theme`), Pretendard, 하단 탭 네비게이션
- **Day 6** — 카테고리 CRUD(보관 포함), 날짜별 할 일 CRUD, 다크 모드 수동 토글,
  GitHub Actions CI

**진행 중**
- 없음. 다음은 Day 7 월간 캘린더.

**아직 안 함**
- 캘린더, 루틴, 팔로우·피드·반응, 데이터 내보내기

## 브랜치 전략

`main`은 배포 브랜치, `develop`이 통합 브랜치다. 작업은 `develop`에 쌓고,
`main` 병합은 PR로 한다. main에 들어가는 순간 Vercel Production이 재배포된다.

---

## MVP 범위

**넣는 것**
로그인 / 날짜별 할 일 + 카테고리 색 / 월간 색 캘린더 / 루틴 /
친구 피드 + 이모지 반응 / 안 읽은 반응 뱃지 / 데이터 내보내기

**빼는 것 (v2 이후)**
타이머, AI 추천, AI 일기, 일기, 리마인더, 웹푸시, 위젯, 워치

---

## 남은 순서

### Day 2 마무리 — DB
위 "진행 중" 세 항목. 끝나면 Vercel 환경변수(DATABASE_URL, DIRECT_URL)를
Production/Preview/Development 전부에 등록하고 push.

### Day 3 — 날짜와 루틴 규칙 (순수 함수)
`lib/date.ts`, `lib/routine.ts`. 아래 "핵심 로직 요구사항" 참고.
**이 두 모듈은 반드시 테스트를 함께 작성한다.** 타임존과 월말 경계 버그는
눈으로 안 보이고, 나중에 "어떤 날은 할 일이 두 번 생긴다"로 터진다.
DB도 인증도 필요 없으므로 여기부터 하는 것이 맞다.

### Day 4 — 인증
Auth.js v5 + Google. DataGSM은 정보가 확보되면 추가.
- 테스트용 우회 모드(`AUTH_MODE=mock`)를 같이 만든다. 프로덕션 빌드에서
  이 값이 켜져 있으면 빌드가 실패하도록 가드를 넣는다.
- 최초 로그인 후 닉네임을 입력받는 온보딩 화면.
  `User.nickname`이 nullable인 이유가 이것이다.
- Auth.js는 같은 이메일의 다른 프로바이더 계정을 기본적으로 자동 연결하지 않고
  `OAuthAccountNotLinked` 에러를 던진다. Google과 DataGSM 모두 검증된 이메일을
  주므로 이메일 기준 연결을 명시적으로 허용한다.

### Day 5 — 디자인 토큰 + 레이아웃
Figma에서 정한 색·타이포를 `app/globals.css`의 `@theme`에 옮긴다.
Tailwind v4는 `tailwind.config.js`를 쓰지 않는다.
하단 탭 네비게이션 (오늘 / 캘린더 / 피드 / 설정).

### Day 6 — 카테고리 + 할 일 CRUD
- 카테고리 생성/수정/순서변경/보관(삭제 대신 `archivedAt`)
- 날짜별 할 일 추가/수정/완료/삭제/순서변경
- 이 시점부터 본인이 투두메이트 끊고 일주일 실사용해본다

### Day 7 — 월간 캘린더
날짜마다 그 날 완료한 할 일의 카테고리 색을 점이나 블록으로 표시.
이 서비스에서 가장 중독성 있는 화면이므로 여기에 시간을 써도 된다.

### Day 8 — 루틴
`matchesRule`은 Day 3에서 이미 있다. 여기서는 생성 시점 로직과 UI.
아래 "루틴 생성 규칙" 참고.

### Day 9 — 팔로우 + 피드 + 반응
- 닉네임으로 사용자 검색, 팔로우/언팔로우
- 피드: 팔로우한 사람들의 완료한 할 일 (공개 카테고리만)
- 이모지 반응, `User.lastSeenAt` 기준 안 읽은 반응 개수 뱃지
- **알림은 만들지 않는다.** 대신 접속 시 뱃지로만 보여준다.

### Day 10 — 데이터 내보내기
사용자가 자기 데이터 전체를 JSON으로 받는 기능.
**친구들을 초대하기 전에 반드시 이게 있어야 한다.**

### Day 11 — 친구 3명 클로즈드 베타
반 전체 말고 3명. 2주 버티면 늘린다.

### Day 12 이후 — 학교 데이터 연동
NEIS Open API로 급식 / 학사일정 / 시간표.
아래 "미확정" 참고.

---

## 핵심 로직 요구사항

### lib/date.ts

모든 날짜는 Asia/Seoul 기준. 서버가 어느 타임존에서 돌든 결과가 같아야 한다.

함수
- `todayKST(): Date` — 오늘의 KST 날짜. 시각은 00:00:00 UTC로 정규화
- `toKSTDateOnly(d: Date): Date` — 임의 시각을 KST 기준 날짜로 절삭
- `formatKST(d: Date): string` — "YYYY-MM-DD"
- `parseKSTDate(s: string): Date` — 형식이 틀리면 throw
- `addDays(d: Date, n: number): Date` — n은 음수 가능, 원본 불변
- `weekdayKST(d: Date): number` — 0=일 … 6=토
- `isSameKSTDate(a: Date, b: Date): boolean`
- `daysBetween(a: Date, b: Date): number` — b - a, 일 단위 정수

반드시 만족할 것
1. 2026-09-15 23:00 KST(=2026-09-15T14:00:00Z)의 날짜는 2026-09-15. 16일이 아니다.
2. 2026-09-15 00:30 KST(=2026-09-14T15:30:00Z)의 날짜는 2026-09-15. 14일이 아니다.
3. addDays(2026-12-31, 1) === 2027-01-01
4. addDays(2027-01-01, -1) === 2026-12-31
5. addDays(2028-02-28, 1) === 2028-02-29 (2028은 윤년)
6. weekdayKST(2026-09-15) === 2 (화요일)
7. weekdayKST(2026-09-13) === 0 (일요일)
8. parseKSTDate("2026-9-15")는 throw (두 자리로 맞춰야 함)
9. parseKSTDate("2026-13-01")은 throw
10. daysBetween(2026-09-15, 2026-09-20) === 5
11. daysBetween(2026-09-20, 2026-09-15) === -5
12. addDays 호출 후 인자로 넘긴 Date 객체가 변하지 않는다
13. 프로세스 TZ가 UTC / Asia/Seoul / America/New_York 어느 것이어도 결과가 같다

### lib/routine.ts — matchesRule(routine, date): boolean

이 루틴이 그 날짜에 할 일을 만들어야 하는가.
routine은 Prisma의 Routine 모델 형태 (freq, byWeekday, byMonthday,
startDate, endDate, pausedAt).

공통 조건 — 하나라도 걸리면 무조건 false
- `pausedAt`이 null이 아니다
- `date < startDate`
- `endDate`가 있고 `date > endDate`

빈도별
- DAILY: 공통 조건만 통과하면 true
- WEEKLY: `byWeekday`에 `weekdayKST(date)`가 포함되면 true
- MONTHLY: `byMonthday`에 date의 "일"이 포함되면 true

반드시 만족할 것
1. `byWeekday`가 빈 배열인 WEEKLY 루틴은 어떤 날짜에도 false
2. `byMonthday`가 빈 배열인 MONTHLY 루틴은 어떤 날짜에도 false
3. `byMonthday`에 31이 있고 대상 달에 31일이 없으면 false.
   말일로 당기지 않는다 (2월 28/29일에 생성하지 않는다)
4. `startDate` 당일은 포함된다
5. `endDate` 당일은 포함된다
6. `pausedAt`이 설정되어 있으면 기간 안이어도 false
7. 날짜 비교는 전부 `lib/date.ts`의 헬퍼를 쓴다. `new Date()` 직접 비교 금지

### 루틴 생성 규칙 (Day 8)

미리 생성하지 않는다. **해당 날짜를 조회하는 순간, 없으면 생성한다.**
cron을 쓰지 않는 이유와 상세한 근거는 `docs/decisions.md` 참고.

```
const due = routines.filter((r) => matchesRule(r, date));
await prisma.todo.createMany({
  data: due.map(...),
  skipDuplicates: true,   // @@unique([routineId, date])가 받아준다
});
```

경계 조건 두 개를 반드시 지킨다.
- **미래 날짜**: 생성하지 않는다. 화면에만 "예정"으로 표시하고,
  사용자가 체크하는 순간에만 실제로 만든다.
  (안 그러면 캘린더를 몇 번 넘기는 것만으로 수천 행이 생긴다)
- **과거 날짜**: 생성 하한은 `max(routine.startDate, user.createdAt, today - 30일)`.
  그보다 과거는 조회만 되고 생성하지 않는다.
  (안 그러면 과거로 스크롤할 때 미완료 루틴이 우수수 생겨 통계가 망가진다)

---

## 미확정 — 임의로 채우지 말 것

### DataGSM OAuth
아직 클라이언트를 만들지 않았다. 다음이 확보되기 전까지 `profile` 매핑을
추측하지 않는다.
- authorize / token / userinfo URL
- 스코프 목록
- **userinfo를 실제로 호출한 응답 JSON**

API 키는 주기적 갱신이 필요하다고 안내되어 있다. 만료되면 신규 로그인이
전부 막히므로, 만료 30일 전에 알림이 오도록 하는 장치를 나중에 만든다.

### NEIS 시간표
`hisTimetable`이 이 학교 데이터를 주는지 확인되지 않았다.
마이스터고는 학과별 실습 블록이 많아 NEIS에 시간표가 비어 있는 경우가 흔하다.
확인 전까지 시간표 기능을 짜지 않는다. 비어 있으면 시간표만 DataGSM으로 폴백한다.

확인용 (KEY는 발급 후 대입)
```
https://open.neis.go.kr/hub/schoolInfo?KEY=&Type=json&SCHUL_NM=광주소프트웨어마이스터고등학교
https://open.neis.go.kr/hub/hisTimetable?KEY=&Type=json&ATPT_OFCDC_SC_CODE=&SD_SCHUL_CODE=&AY=2026&SEM=2&ALL_TI_YMD=20260915&GRADE=2
```

급식(`mealServiceDietInfo`)과 학사일정(`SchoolSchedule`)은 어느 학교든
잘 들어오므로 NEIS 직접 호출로 간다.

### GSMSV 이관
PROJECT_OWNER 승인 후 검토. 일반 사용자 VM은 30일 뒤 자동 삭제되고
복구가 불가능하므로 그 전에는 프로덕션을 올리지 않는다.
HTTPS는 Cloudflare Tunnel로 해결한다 (Public IP 불필요).
상세 근거는 `docs/decisions.md` 참고.
