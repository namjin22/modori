# 모도리 로드맵

새 세션을 시작할 때 이 문서와 `docs/decisions.md`를 먼저 읽는다.
날짜별로 무엇을 했는지는 `docs/handoff.md`, 써 보며 찾은 개선점은 `docs/backlog.md`에 있다.

---

## 현재 상태 (2026-09-28, 출시 직전)

**운영**: https://modori.site. 교내 서버 GSMSV의 VM 한 대에 Docker로 앱과 PostgreSQL 18을 띄우고,
Cloudflare Tunnel로 HTTPS를 붙였다. `main`에 합치면 GitHub Actions(`deploy-gsmsv`)가 이미지를 만들어
VM에 올리고, 새 버전이 뜨지 않으면 직전 버전으로 되돌린다. 매일 04:00 백업(VM 안 7일 + 백업용 Neon).
구성과 명령은 `deploy/README.md`, 옮긴 과정은 `docs/gsmsv-migration.md`.
예전 주소 modori.vercel.app은 modori.site로 넘긴다. 출시 전에 운영 DB의 사용자 데이터를 모두 비웠다.

**있는 기능**
- 로그인: Google, DataGSM(학생·교사). 가입할 때 닉네임과 개인정보 수집·이용 필수 동의(`/privacy`)
- 피드(홈): 날짜별 할 일을 카테고리별로 적고 체크·수정·드래그로 순서 바꾸기·지우기(되돌리기). 끝낸 일은 묶음 아래로,
  진행 막대는 끝낸 일의 카테고리 색으로 찬다
- 달력: 넓은 화면은 왼쪽에 한 달 달력, 좁은 화면은 주간 줄과 "달력" 펼치기. 날짜 아래 고양이 머리 표시가
  끝낸 할 일의 카테고리 색으로 한 칸씩 찬다. 여러 날에 걸친 일정은 이름으로 보인다
- 일정: 여러 날·시작/끝 시간(비우면 하루 종일)·D-day, 하루 5개까지. 달력에서 일정 이름을 다른 날로 끌면 기간이 바뀐다
- 루틴(매일·요일·날짜, 그날을 열 때 할 일로 만든다), 카테고리(색 여덟 가지, 만들 때 공개/비공개, 끌어서 순서, 최대 10개)
- 소셜: 닉네임 검색·팔로우, 위쪽 친구 줄에서 친구 한 명의 하루 보기, 반응(도리 표정 12 + 이모지 12),
  받은 반응과 안 읽은 수 뱃지, 팔로우·팔로워 목록(맞팔로우, 팔로워 끊기)
- 기록: 달마다 끝낸 개수·해낸 비율(오늘까지)·이어온 날, 카테고리별·요일별
- 마이페이지: 프로필(닉네임·소개·사진), 테마(라이트·다크), 로그아웃(한 번 더 묻는다), 계정 지우기, 방침, 의견 메일 주소, 오류 기록(운영자만)
- 데스크톱 앱(Windows, `desktop/`): 웹을 창 하나로 띄우는 Electron 앱. 로그인은 평소 브라우저에서 하고 `modori://`로 넘겨받는다.
  마이페이지 "Windows 앱 받기"(GitHub 릴리스)
- 캐릭터 도리: 표정 12가지. 진행률 옆·기록·빈 화면·오류 화면·반응·기본 프로필 사진에 쓴다
- 운영 장치: 요청 속도 제한, 개수 상한(할 일 하루 50·카테고리 10·루틴 50·일정 1000), 오류 기록과 매시간 알림(`errors`),
  상태 감시(`health`)

**남은 것**: `docs/release-checklist.md`(실제 폰 확인, 방침 확인 등). 개선 후보는 `docs/backlog.md` 맨 아래.

---

## 지나온 과정

| 날짜 | 한 일 |
|---|---|
| 9/15~16 | Next.js 16 프로젝트, Vercel + Neon 배포, Prisma 6 스키마, `lib/date.ts`·`lib/routine.ts`와 단위 테스트, Google 로그인과 테스트용 우회 로그인, 닉네임 온보딩, 디자인 토큰, 카테고리·할 일, 월간 달력, 루틴, 팔로우·피드·이모지 반응, 안 읽은 반응 뱃지, 드래그 순서, PWA manifest |
| 9/17 | 피드 더 보기, 주간 줄과 카테고리 묶음, 계정 지우기, 친구 한 명의 하루, 확인창 없이 지우고 되돌리기, 탭을 피드·소셜·설정으로 줄이고 달력을 피드에 붙임, 첫 도리 |
| 9/20~22 | 일정을 할 일과 나눔, DataGSM(PKCE) 로그인, 도리를 크림색 고양이로, 프로필 사진, 공용 입력칸과 "내일로" 버튼을 없애고 칩의 +로만 적기, 떠 있는 창에서 고치기 |
| 9/23~24 | 기록 화면, D-day, 반응 열두 가지, 색 여덟 가지, 친구 화면에 달력, 도리를 얼굴만 있는 캐릭터로, 카테고리는 보관 대신 삭제, 용량 점검(`docs/capacity.md`) → 링크 미리 불러오기 줄임 |
| 9/25~27 | GSMSV VM으로 이관(도메인 modori.site, Cloudflare Tunnel, 백업, 배포 되돌리기, 복구 훈련), 개수 상한, 소셜 친구 줄, 설정 → 마이페이지, 앱 모양 입력 말풍선, 로그인 뒤 원래 화면으로 |
| 9/28 | 개인정보처리방침·가입 동의, 팔로워 목록, 요청 속도 제한, 오류 기록, 도리 표정 다듬기·반응에 도리, 달력 채움 표시, 출시 전 점검(`docs/backlog.md` "출시 전 점검"), 팔로워 끊기, 로그아웃 확인, 일정 시간·하루 5개·달력 끌기, 빈 입력칸 닫기, 진행 막대 색, 끝낸 일 아래로, 카테고리 공개 선택·끌어서 순서 |

| 9/28~29 | 손가락 끌기 테스트, 진행 막대 흰색·검정 윤곽, 데스크톱 앱(Electron)·브라우저 로그인 넘겨받기·마이페이지 다운로드 |

---

## 브랜치와 배포

`main`은 배포 브랜치, `develop`이 통합 브랜치다. 작업은 `develop`에 쌓고 `main`에는 PR로 합친다.
PR마다 `verify`(타입·린트·단위·E2E)가 돌고, `main`에 들어가는 순간 GSMSV VM에 재배포된다.
커밋은 `<type>: <한글 한 줄 요약>`, 한 커밋에 한 가지 변경.

---

## 범위

**넣은 것**
로그인 / 날짜별 할 일 + 카테고리 색 / 달력 / 루틴 / 일정과 D-day / 친구 피드와 반응 / 안 읽은 반응 뱃지 / 기록

**영구 제외**
타이머, AI 추천, AI 일기, 일기, 리마인더, 웹 푸시, 위젯, 워치는 만들지 않는다.
사용자가 이 결정을 명시적으로 철회하기 전까지 이후 계획에도 넣지 않는다.
알림은 만들지 않는다. 받은 반응은 들어왔을 때 뱃지로만 보여준다.

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

### 루틴 생성 규칙 (`lib/routine-todos.ts`)

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

---

## 미확정 — 임의로 채우지 말 것

### DataGSM API 키 만료
로그인은 운영에서 된다(`lib/auth.ts`). DataGSM API 키는 주기적 갱신이 필요하다고 안내되어 있다.
만료되면 DataGSM 로그인이 전부 막히므로 만료일을 확인해 `docs/release-checklist.md`에 적어 둔다.

### 학교 데이터 연동 (NEIS)
급식(`mealServiceDietInfo`)과 학사일정(`SchoolSchedule`)은 NEIS Open API를 직접 부르기로 했다
(`docs/decisions.md` "학교 데이터는 DataGSM 대신 NEIS를 직접 호출한다"). 아직 만들지 않았다.

### NEIS 시간표 (확인 전)
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
