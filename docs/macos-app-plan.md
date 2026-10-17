# macOS 앱 기획 (2026-10-17)

맥 사용자에게 모도리를 "앱"으로 주는 방법을 고른다. Windows 앱(Electron, `desktop/`)·iOS 앱(Capacitor, `mobile/ios`)과 같은 화면 코드(modori.site)를 쓴다는 원칙은 그대로다(`docs/platforms.md`).

## 먼저 걸리는 조건

- **Apple 개발자 계정의 주인은 학교(교장 선생님)이다.** 연락할 수 없고, 친구가 보관한 계정의 App Store Connect API 키로만 배포한다(memory, `docs/mobile-release.md`).
- 맥 앱을 **App Store 밖**(웹에서 내려받기)으로 주려면 Apple의 **Developer ID 인증서로 서명·공증**해야 한다. 서명이 없으면 맥이 "확인되지 않은 개발자"·"손상된 앱"이라며 열지 않는다. Developer ID 인증서는 계정 주인(Account Holder)만 만들 수 있는 것으로 알고 있다 → **사실상 막혀 있다.** (계정 화면에서 역할을 한 번 확인할 것.)
- 그래서 현실적인 길은 **App Store를 통한 배포**다. 지금 iOS 앱을 올리는 방식(API 키 자동 서명)을 그대로 쓸 수 있다.
- 지금 iOS 1.0이 심사 대기 중이다. 맥 작업은 iOS 승인 뒤에 한다.

## 선택지

| | 방법 | 맥에서 보이는 모습 | 할 일 | 알림 | 막히는 점 |
|---|---|---|---|---|---|
| A | **iPhone 앱을 그대로 Apple silicon 맥에서**(App Store Connect의 "Apple silicon Mac에서 iPhone·iPad 앱 사용") | 아이폰 크기 창. 창 크기 조절이 어색하다 | 거의 없음(설정 확인, 맥에서 실행 점검) | iOS와 같이 된다 | M1 이상 맥만. 인텔 맥 불가. "폰 앱을 띄운" 느낌 |
| B | **Mac Catalyst**(지금 iOS 프로젝트에 Mac 대상 추가) | 크기 조절되는 맥 창, 메뉴 막대 | Xcode 설정·아이콘·창 크기·키보드 단축키, CI에 Mac 빌드·업로드 추가 | APNs(같은 키) | Catalyst 대상 추가 뒤 Capacitor 플러그인 호환 점검 필요. 별도 심사 |
| C | **Windows 앱(Electron)의 맥 빌드** | Windows 앱과 같은 창 | 빌드 설정만 | 데스크톱은 알림 없음(지금 정책) | App Store 밖 배포는 Developer ID 서명이 필요해 막힘. Mac App Store용 Electron은 샌드박스·인증서 작업이 커서 B보다 비싸다 |
| D | **Safari "Dock에 추가"**(웹 앱) | 주소창 없는 창 | 사용법 안내만 | 없음(웹 푸시는 만들지 않는다, `docs/roadmap.md`) | 설치를 사용자가 직접 해야 한다 |

## 추천 순서

1. **지금: D를 안내**한다. 코드 없이 오늘부터 맥에서 앱처럼 쓸 수 있다(Safari → 파일 → Dock에 추가). 지원 페이지(`/support`)에 한 줄.
2. **iOS 승인 직후: A를 켠다/확인한다.** App Store Connect → 가격 및 사용 가능 여부에서 Mac(Apple silicon) 제공이 켜져 있는지 보고, 빌린 맥북(M 칩이면)으로 App Store에서 받아 로그인·알림·끌기를 점검한다. 비용이 거의 없고 맥 사용자 수를 재 볼 수 있다.
3. **맥 사용자가 실제로 늘면: B(Mac Catalyst)**로 제대로 된 맥 창을 만든다. 예상 1~2주. 그 전에 지표로 맥에서 쓰는 사람 수를 확인한다(user agent로 셀 수 있다, 새 저장 항목이면 규칙 8).
4. **C는 하지 않는다.** 서명 문제로 일반 배포가 막혀 있고, 같은 비용이면 B가 낫다.

## B를 할 때 확인할 것 (미리 적어 둠)

- Xcode에서 App 대상에 "Mac (Designed for iPad)"가 아닌 **Mac Catalyst** 체크, 번들 ID는 같게(유니버설 구매) 둘지 결정.
- `MainViewController.swift`의 앱 안 로그인(ASWebAuthenticationSession)이 Catalyst에서 같은 방식으로 되는지.
- 창 최소 크기와 넓은 화면 레이아웃(웹은 이미 `lg:` 두 칸 화면이 있다).
- 푸시: Catalyst 앱도 APNs. 서버(`lib/apns.ts`)는 그대로, 기기 종류만 `ios`로 들어온다.
- CI(`.github/workflows/ios.yml`)에 `-destination 'generic/platform=macOS,variant=Mac Catalyst'` 빌드와 업로드 추가.
- 심사: 맥 스크린샷(1280×800 이상) 필요.

## 정하지 않은 것

- 맥에서 데스크톱 알림을 줄지. 지금 Windows 앱은 알림을 주지 않는다(`docs/platforms.md`). A·B는 iOS와 같이 푸시가 오므로 정책을 맞춰야 한다.
