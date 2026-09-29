# 모도리 모바일 앱

modori.site를 앱 창 하나로 띄우는 [Capacitor](https://capacitorjs.com) 앱입니다. 기능은 전부 웹에 있고, 앱은 창·로그인 넘겨받기·(예정) 푸시 알림만
맡습니다(`docs/platforms.md`). 지금은 Android만 있고 iOS는 맥북을 빌린 뒤에 붙입니다.

## 구성

- `capacitor.config.json`: `server.url`이 운영 주소라 웹을 고쳐 배포하면 앱 스토어 업데이트 없이 화면이 바뀝니다. 서버에 닿지 못하면
  `www/offline.html`이 뜹니다. 사용자 에이전트 끝에 `ModoriMobile/…`을 붙여 웹이 앱 안인 것을 압니다(`lib/desktop.ts`).
- `android/`: Capacitor가 만든 Android 프로젝트. `modori://login` 링크를 받는 설정과 기기 백업 끄기(`allowBackup=false`)를 더했습니다.

## 로그인

Google은 앱 안에 끼운 화면(WebView)에서의 로그인을 막습니다. 데스크톱 앱과 같은 방식으로, 앱의 로그인 버튼이 시스템 로그인 창(Custom Tabs)을
열고 거기서 로그인을 마치면 서버가 `modori://login?code=…`로 앱을 엽니다. 앱은 코드와 처음 만든 verifier를 서버에 보내 세션을 받습니다(PKCE).

- 웹 쪽: `components/native-login-buttons.tsx`(버튼), `components/native-bridge.tsx`(링크 받기), `lib/native-login.ts`, 서버는 `lib/desktop-login.ts`·
  `app/desktop/login`·`app/api/desktop/exchange`를 데스크톱과 함께 씁니다.
- 자동 시험은 가짜 Capacitor 다리로 이 흐름을 확인합니다(`tests/e2e/mobile-login.spec.ts`). 실제 기기에서는 아직 확인하지 못했습니다.

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
- 앱 아이콘·스플래시(지금은 Capacitor 기본 그림), 스토어용 서명 키와 AAB, 스토어 소개·스크린샷.
- iOS: 맥북에서 `npx cap add ios`, Apple 로그인(가이드라인 4.8).
