# App Store 등록정보 (한국어)

App Store Connect → 앱 → 배포 화면에 그대로 붙여 넣는다. 제외 기능(타이머·일기·AI, CLAUDE.md 규칙 7)은 쓰지 않는다.
Google Play 등록정보는 `docs/store-listing.md`, 서명·업로드 방법은 `docs/mobile-release.md`.

## 앱 정보

| 칸 | 값 |
|---|---|
| 이름 (30자) | 모도리 |
| 부제 (30자) | 친구와 함께 채우는 매일 할 일 |
| 기본 카테고리 | 생산성 |
| 보조 카테고리 | 라이프스타일 |
| 저작권 | 2026 이남진 |
| 개인정보 처리방침 URL | https://modori.site/privacy |
| 지원 URL | https://modori.site/support |
| 마케팅 URL | https://modori.site |
| 가격 | 무료, 인앱 결제 없음 |
| 지원 국가 | 대한민국만으로 시작(해외 친구가 있으면 모든 국가로 넓힌다. 앱은 휴대폰 시간대를 자동으로 따라 쓸 수 있다) |

## 프로모션 텍스트 (170자, 심사 없이 언제든 바꿀 수 있다)
오늘 할 일을 적고, 친구가 끝낸 일에 도리 표정으로 반응을 보내 보세요. 할 일과 일정을 루틴으로 반복하고, 정한 시각에 남은 할 일을 알려 줘요.

## 설명 (4000자)
모도리는 친구와 함께 매일을 채워 가는 할 일 앱이에요.

날짜별로 할 일을 적고, 카테고리 색으로 나눠 한눈에 보세요. 끝낸 일이 늘수록 고양이 도리가 색으로 채워져요.

■ 할 일
- 카테고리마다 색을 정해 날짜별로 기록해요. 자주 쓰는 색 8가지 말고도 100가지 색이나 색상 코드로 고를 수 있어요.
- 할 일마다 메모를 남겨요.
- 못 끝낸 일은 버튼 하나로 한꺼번에 내일로 넘기거나, 하나씩 다른 날로 옮겨요.
- 할 일을 길게 눌러 끌면 순서를 바꾸고 다른 카테고리로 옮겨요.

■ 루틴
- 매일, 요일마다, 매달 같은 날처럼 반복되는 할 일을 루틴으로 등록해요.
- 학원·동아리 모임처럼 반복되는 일정도 루틴으로 만들 수 있어요.

■ 달력과 일정
- 한 달 달력에서 날짜를 누르면 바로 그날의 할 일이 보여요.
- 시험, 발표처럼 기다리는 날은 일정으로 적고 D-day를 확인해요.

■ 친구와 함께
- 친구를 팔로우하면 친구의 할 일과 일정을 볼 수 있어요.
- 끝낸 일에 이모지나 도리·몽이·하루·펭이 표정으로 반응을 보내요.
- 보여 주고 싶지 않은 카테고리·일정·메모는 "비공개"를 켜면 나만 봐요.
- 불쾌한 사람은 신고하거나 차단할 수 있어요.

■ 알림
- 친구가 보낸 반응, 새 팔로워, 친구가 끝낸 할 일을 알려 줘요. 친구가 끝낸 일 알림은 끌 수 있어요.
- 원하면 하루 한 번, 정한 시각에 오늘 남은 할 일 수를 알려 줘요.

■ 기록
- 달력과 통계로 내가 얼마나 채웠는지 돌아봐요.

■ 어디서 살든
- 휴대폰의 시간대를 자동으로 따라, 지금 있는 곳의 자정에 하루가 바뀌어요.

■ 안심하고 쓰세요
- 비밀번호를 만들지 않아요. Apple 또는 Google 계정으로 로그인해요.
- 광고가 없고, 사용자를 추적하지 않아요.
- 마이페이지의 "계정 지우기"로 언제든 모든 기록을 지울 수 있어요.

문의: penamjin@gmail.com

## 키워드 (100자, 쉼표로 구분, 이름·카테고리 말은 넣지 않는다)
투두,할일,루틴,캘린더,달력,D-day,디데이,습관,일정,기록,플래너,스터디,학생,친구,통계

## 이 버전의 새로운 기능 (처음 올리는 버전)
모도리의 첫 iOS 버전이에요.

## 스크린샷
`docs/screenshots/store-listing/store-ios-1…6-*.png` (iPhone 6.9인치, 1320×2868). 순서는 1 홈·달력, 2 소셜, 3 친구 화면, 4 반응 보내기, 5 알림, 6 기록.
6.9인치 한 벌이면 다른 크기는 자동으로 맞춰진다. 다시 찍으려면 `STORE_ASSETS=ios SCREENSHOT_DIR=store-listing npm run screenshots`.
iPad는 지원하지 않는다(iPhone 전용).

## 연령 등급 질문 답
- 폭력·성적 내용·욕설·도박·공포·약물: 모두 "없음".
- 사용자가 만든 내용을 다른 사람에게 보여 준다: **예**(친구의 닉네임·소개·사진·할 일). 신고와 차단 수단이 있고 운영자가 확인한다.
- 제한 없는 웹 접근: 아니요. 채팅·메시지: 아니요(반응 이모지만 있다).
- 결과 등급은 질문 답에 따라 정해진다. 사용자 콘텐츠 때문에 12+ 안팎이 나올 수 있다.

## 앱 개인정보(App Privacy) 답
추적(Tracking): **아니요**. 광고·데이터 중개에 쓰지 않는다. 아래는 모두 "앱 기능" 목적이고 사용자와 연결된다.

| 데이터 | 수집 | 연결 | 용도 | 근거 |
|---|---|---|---|---|
| 연락처 정보 → 이메일 주소 | 예 | 예 | 앱 기능(로그인) | `User.email` |
| 연락처 정보 → 이름 | 예(닉네임) | 예 | 앱 기능(친구 찾기) | `User.nickname` |
| 사진 또는 동영상 | 예(프로필 사진, 선택) | 예 | 앱 기능 | `User.profileImage` |
| 사용자 콘텐츠 → 기타 사용자 콘텐츠 | 예 | 예 | 앱 기능 | 할 일·소개·메모·신고 내용 |
| 식별자 → 사용자 ID | 예 | 예 | 앱 기능 | 로그인 계정 번호 |
| 사용 데이터 → 제품 상호작용 | 예 | 예 | 분석(내부 통계) | `ActiveDay`(쓴 날짜, 90일) |
| 진단 → 비정상 종료·성능 데이터 | 예 | **아니요** | 앱 기능(오류 고치기) | `ErrorEvent`(사용자와 잇지 않음) |
| 식별자 → 기기 ID | 알림을 허용한 경우만 | 예 | 앱 기능(알림) | `PushToken` (iOS는 알림을 켠 뒤) |

위치, 연락처 목록, 건강, 재정, 검색 기록, 탐색 기록 등은 수집하지 않는다. 정확한 근거는 `docs/privacy-inventory.md`.

## 심사 메모 (App Review Information)

연락처: 이남진 / penamjin@gmail.com / 전화번호는 직접 입력.

로그인 정보(Sign-in required): 심사용 계정을 직접 만들어 넣는다.
- 모도리는 비밀번호 로그인이 없고 Google·Apple·DataGSM으로만 로그인한다(CLAUDE.md 규칙 4).
- 심사자는 자기 Apple ID로 "Apple로 계속하기"를 눌러 들어올 수 있다. 그래도 심사용 Google 계정(2단계 인증을 끈 새 계정)을 하나 만들어 아이디·비밀번호를 적어 두면 막히지 않는다.
- 친구 기능을 보여 주려고, 심사용 계정이 팔로우한 시연용 계정과 공개 할 일을 미리 만들어 둔다.

메모(영문, 아래를 그대로 붙여 넣는다). 2026-10-20에 다시 썼다: 심사자가 3분 안에 기능을 다 볼 수 있게 순서를 주고, 아이폰에서만 되는 기능(푸시·Apple 로그인)을 앞에 둔다. 2026-10-28에 하루 한 번 리마인드를 없애 아래 메모의 4번과 마지막 문단에서 뺐다(이미 App Store Connect에 붙여 넣은 메모는 직접 고쳐야 한다).
"웹을 감싼 앱"이라고 먼저 소개하던 문장은 뺐다(4.2 최소 기능 심사에서 그 말부터 보게 된다). 서버에서 화면을 받아 네트워크가 필요하다는 사실은 그대로 적는다.

```
Demo account: tap "Continue with Google" and sign in with the account in the Sign-In Information fields (2-step verification is off). You can also use "Sign in with Apple" with any Apple ID.
The demo account already follows a demo friend "모도리친구", who has tasks, reactions and an upcoming exam, so every social screen has content.

What to try (about 3 minutes)
1. Home (피드 tab): add a task, tap its checkbox to complete it, long-press and drag to reorder. The "관리" (Manage) menu opens Categories, a new Event, and Routines (repeating tasks and events).
2. Social (소셜 tab): tap 모도리친구 to see their tasks and events, then tap an emoji under a completed task to react.
3. Social > 알림 (Notifications): reactions, new followers and friends' completed tasks.
4. My Page (마이페이지) > 알림: allow notifications to receive push notifications for reactions, new followers and friends' completed tasks (can be turned off), and create your own alarms ("내가 정한 알림") that send a push notification with your own text at the time and weekdays you choose.

On iPhone, Modori uses native push notifications (APNs), Sign in with Apple, and the device time zone automatically. Screens are loaded from our server (https://modori.site), so a network connection is required.

Account deletion: My Page > "계정 지우기" (Delete account) at the bottom. Type your nickname to confirm. All data is deleted and the Sign in with Apple token is revoked.

User-generated content (Guideline 1.2): users only see people they follow (nickname, bio, profile photo, and the tasks and events they did not mark private).
- Report: on a user's page, tap "⋯" at the top > 신고하기 (Report), choose a reason.
- Block: same menu > 차단하기 (Block). Follows and reactions are removed both ways and the two users can no longer see each other.
- The operator reviews reports within 24 hours and removes offending content and accounts. The Terms of Use (My Page > 이용약관) prohibit objectionable content.

No ads, no tracking, no in-app purchases. Contact: penamjin@gmail.com
```

## 다시 제출하기 (2026-10-20, 심사 대기 6일)

"심사 대기 중"은 아직 아무도 보지 않은 상태라, 제출 내용이 막힌 원인일 가능성은 낮다. 심사에서 빼면 줄 맨 뒤로 간다. 그래도 다시 내는 이유는 제출 뒤에 서버 쪽 기능이 늘어 설명이 실제 앱과 달라졌기 때문이다(친구가 끝낸 일 알림, 반복 일정, 일정·메모 보기, 비공개 스위치, 100색). 설명과 앱이 다르면 2.3(정확한 메타데이터)으로 거절될 수 있다.

1. 시연 데이터를 오늘 기준으로 다시 깐다: `deploy/refresh-review-demo.sql`(심사가 사흘 넘게 안 열리면 한 번 더).
2. App Store Connect → 앱 심사 → 제출 항목을 열고 "심사에서 제거". 버전 상태가 "개발자 거부됨"이 된다.
3. iOS 1.0 버전 화면에서 프로모션 텍스트·설명·심사 메모를 위 글로 바꾼다. 빌드는 같은 것을 쓴다(새 빌드 필요 없음).
4. 앱 개인정보·연령 등급이 "완료"인지 확인하고 "심사에 추가" → "심사에 제출".
5. 다시 48시간 넘게 "심사 대기 중"이면 App Store Connect 맨 아래 "문의하기" → App Review → 심사 상태 문의를 보낸다. 줄 순서는 잃지 않는다.

공개 피드("모두" 탭)는 2026-10-26에 기능 자체를 뺐다(운영자 결정). 설명·심사 메모에 피드 이야기는 없으니 그대로 쓴다. 1.0.1에서 켜는 일도 없다.

## 올리기 전 확인
- [x] (2026-10-13) 서버에 Apple 로그인 키 4개를 넣었고 로그인 화면에 "Apple로 계속하기"가 보인다(`docs/mobile-release.md` 4절)
- [x] (2026-10-14, 운영자 확인: 로그인·알림·계정 지우기) TestFlight에서 실제 iPhone으로 로그인 → 앱으로 돌아오기, 여백, 길게 눌러 옮기기를 확인했다
- [x] (2026-10-14) 심사용 Google 계정과 시연용 친구 계정을 만들었다(`deploy/seed-review-demo.sql`)
- [ ] 개인정보(App Privacy) 답과 연령 등급을 입력했다
- [ ] 수출 규정(암호화): 앱이 HTTPS만 써서 면제(`ITSAppUsesNonExemptEncryption=false`가 이미 들어 있다)
