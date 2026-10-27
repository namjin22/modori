# 모도리 데스크톱 앱

modori.site를 창 하나로 띄우는 Electron 앱입니다. 기능은 전부 웹에 있고, 앱은 창과 로그인 넘겨받기만 맡습니다.

## 로그인

Google은 앱 안에 끼운 브라우저에서의 로그인을 막습니다. 그래서 앱 창의 "Google로 계속하기"·"DataGSM으로 계속하기"를 누르면
평소 쓰는 브라우저가 열리고, 로그인을 마치면 `modori://` 링크로 앱에 돌아옵니다.

1. 앱이 비밀값(verifier)을 만들고 브라우저로 `/desktop/login?challenge=…&provider=…`를 연다
2. 브라우저에서 로그인(처음이면 가입)을 마치면 서버가 2분짜리 코드를 만들어 `modori://login?code=…`로 앱을 연다
3. 앱이 코드와 verifier를 `/api/desktop/exchange`에 보내 세션 쿠키를 받는다

서버 쪽은 `lib/desktop-login.ts`, `app/desktop/login`, `app/api/desktop/exchange`에 있습니다.

## 실행과 빌드

```bash
cd desktop
npm install                 # Electron 실행 파일도 받는다(allowScripts)
npm start                   # modori.site를 띄운다
MODORI_URL=http://localhost:3000 npm start   # 로컬 서버를 띄운다
npm run dist                # Windows 설치 파일 → dist/Modori-Setup.exe
```

VS Code 같은 Electron 기반 편집기의 터미널에서는 `ELECTRON_RUN_AS_NODE`가 물려 와 Electron이 Node로 뜰 수 있습니다.
그러면 `env -u ELECTRON_RUN_AS_NODE npm start`로 실행합니다.

## 배포

`package.json`의 `version`을 올리고 같은 번호로 `desktop-v1.0.1` 태그를 올리면 GitHub Actions(`desktop`)가
Windows·macOS 설치 파일을 만들어 릴리스에 붙입니다. 웹 마이페이지의 "Windows 앱 받기"는 가장 최근 릴리스를 가리킵니다.

코드 서명 인증서가 없어서 처음 설치할 때 Windows SmartScreen이 "알 수 없는 게시자"라고 경고합니다.
"추가 정보 → 실행"으로 설치할 수 있습니다.

## 앱 안 업데이트

1.0.7부터 앱 안에서 업데이트한다(Windows만. 맥 앱은 코드 서명이 없어 macOS가 자동 교체를 막는다). `updater.js`가 켠 15초 뒤와
4시간마다 GitHub 릴리스의 `latest.yml`을 보고, 새 버전이 있으면 웹 화면(`components/desktop-update.tsx`)이 카드와 마이페이지 줄로 알린다.
버튼을 누르면 바뀐 부분만 받아(`.blockmap`) 해시를 확인하고, 조용히 설치한 뒤 앱을 다시 연다.

- 받는 곳은 설치 파일 안의 `app-update.yml`(`package.json`의 `build.publish`)이 정한다. 웹 화면이 넘기는 값은 없다.
- 릴리스에는 `Modori-Setup.exe`, `Modori-Setup.exe.blockmap`, `latest.yml`이 모두 있어야 한다. `desktop` 워크플로가 이 셋을 올리고,
  `latest.yml`이 태그 버전을 가리키는지 확인한 뒤에야 릴리스를 공개한다.
- 개발 중(`npm start`)에는 켜지지 않는다. `dev-app-update.yml`은 시험이 가짜 업데이트 서버로 돌릴 때만 읽는다(`tests/e2e/desktop-app.spec.ts`).
- 1.0.6 이하는 이 기능이 없어서 한 번은 새로 설치해야 한다.

## 시험

앱 동작은 웹 저장소의 `tests/e2e/desktop-app.spec.ts`가 실제로 앱을 띄워 확인합니다(이 폴더에 Electron을 설치한 곳에서만).
