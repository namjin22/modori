# 모도리 모바일 앱

modori.site를 앱 창 하나로 띄우는 [Capacitor](https://capacitorjs.com) 앱입니다. 기능은 전부 웹에 있고, 앱은 창·로그인 넘겨받기·(예정) 푸시 알림만
맡습니다(`docs/platforms.md`). Android와 iOS가 있습니다. iOS는 맥 없이 GitHub의 macOS 러너가 빌드합니다(`docs/mobile-release.md`).

## 구성

- `capacitor.config.json`: `server.url`이 운영 주소라 웹을 고쳐 배포하면 앱 스토어 업데이트 없이 화면이 바뀝니다. 서버에 닿지 못하면
  `www/offline.html`이 뜹니다. 사용자 에이전트 끝에 `ModoriMobile/…`을 붙여 웹이 앱 안인 것을 압니다(`lib/desktop.ts`).
- `android/`: Capacitor가 만든 Android 프로젝트. `modori://login` 링크를 받는 설정과 기기 백업 끄기(`allowBackup=false`)를 더했습니다.
- `ios/`: Capacitor가 만든 iOS 프로젝트(플러그인은 Swift Package). `Info.plist`에 `modori://` 링크, 한국어, 세로 화면, iPhone 전용,
  암호화 신고 면제(`ITSAppUsesNonExemptEncryption=false`, HTTPS만 씀)를 더했습니다. 로그인 창은 SFSafariViewController라 링크를 받으면 웹이 닫습니다.

## 로그인

Google은 앱 안에 끼운 화면(WebView)에서의 로그인을 막습니다. 데스크톱 앱과 같은 방식으로, 앱의 로그인 버튼이 시스템 로그인 창(Custom Tabs)을
열고 거기서 로그인을 마치면 서버가 `modori://login?code=…`로 앱을 엽니다. 앱은 코드와 처음 만든 verifier를 서버에 보내 세션을 받습니다(PKCE).

- 웹 쪽: `components/native-login-buttons.tsx`(버튼), `components/native-bridge.tsx`(링크 받기), `lib/native-login.ts`, 서버는 `lib/desktop-login.ts`·
  `app/desktop/login`·`app/api/desktop/exchange`를 데스크톱과 함께 씁니다.
- 자동 시험은 가짜 Capacitor 다리로 이 흐름을 확인합니다(`tests/e2e/mobile-login.spec.ts`). 실제 기기에서는 아직 확인하지 못했습니다.

## 홈 화면 위젯(Android·iPhone)

오늘 남은 할 일을 홈 화면에서 본다(읽기 전용, Android 2026-11-20, iPhone 2026-11-21). Android는 폰 홈 화면을 길게 눌러 위젯 → 모도리 → "오늘 남은 할 일"을 놓는다. 크기를 키우면 더 많은 줄이 보인다.

- 목록과 개수는 서버가 정한다(`GET /api/widget`, `lib/widget.ts`). 앱(`ModoriWidgetProvider.java`)은 앱 웹뷰의 로그인 쿠키(`CookieManager`)를 그대로 실어 부르고 받은 대로 그린다. 그래서 앱에 로그인해 있어야 한다. 로그아웃하거나 로그인이 만료되면 "앱을 열어 로그인해 주세요"가 뜬다.
- 새로 고침은 30분마다(시스템이 정하는 최소), 위젯의 새로 고침 단추, 앱 화면을 떠날 때(`MainActivity.onPause`, 2초 뒤)다. 못 받으면 12시간 안의 마지막 목록을 "새로 못 받음"과 함께 보여 준다.
- 마지막 목록(할 일 제목·색·개수)은 이 앱 전용 저장소에만 두고 서버로 보내지 않는다. 위젯을 모두 지우거나 로그인이 풀리면 지운다(`docs/privacy-inventory.md`).
- **iPhone**: 홈 화면을 길게 눌러 편집 → 위젯 추가 → 모도리(작은·중간·큰, iOS 17 이상). 위젯 확장은 `ios/App/ModoriWidget`(번들 `site.modori.app.widget`)이다. 위젯은 앱과 다른 프로세스라 웹뷰 쿠키를 직접 못 읽는다. 그래서 앱이 화면을 떠날 때(`MainViewController.syncWidget`) 웹뷰의 로그인 쿠키를 공유 키체인(`WidgetSession`)에 적고 2초 뒤 위젯을 새로 고친다. **위젯을 놓은 뒤 앱을 한 번 열었다 떠나야** 로그인이 넘어간다. 홈 화면에 위젯이 없거나 로그아웃했으면 키체인에서 지운다. 마지막 목록은 위젯 확장의 캐시 폴더에 둔다.
- iPhone 위젯의 App ID·프로필은 `ios.yml`의 자동 서명이 만든다(손으로 만들 것이 없다). 위젯 대상은 Xcode 없이 `App.xcodeproj/project.pbxproj`에 손으로 넣었다. Xcode에서 열어 고치면 그 파일이 다시 쓰이니, 바뀐 것을 확인하고 커밋한다.
- **실제 폰에서 확인하지 못했다**(Android·iPhone 모두, `docs/decisions.md` 2026-11-20·2026-11-21). 맥은 없다.

## 빌드

Android SDK가 없는 PC에서도 GitHub Actions의 `android` 워크플로가 시험용 APK를 만듭니다(Actions → android → Run workflow → 결과물
`modori-android-debug`). 내 PC에서 만들려면 Android Studio(또는 SDK)와 Java 21이 필요합니다.

```bash
cd mobile
npm install
npx cap sync android
cd android && ./gradlew assembleDebug     # app/build/outputs/apk/debug/app-debug.apk
```

폰에 설치: APK 파일을 폰으로 옮겨 열거나 `adb install app-debug.apk`(폰의 "출처를 알 수 없는 앱 설치"를 허용해야 할 수 있습니다).

## 아직 없는 것

- 푸시 알림(친구가 보낸 반응·새 팔로워): Firebase 프로젝트와 `google-services.json`이 필요하다.
- iOS 푸시 알림(Firebase를 iOS에 붙여야 한다), 실제 iPhone에서의 확인(첫 TestFlight 빌드에서).
