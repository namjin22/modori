# 모바일 앱 스토어에 올리기

안드로이드는 아래 1~4, iOS는 "iOS (App Store·TestFlight)" 절.

## 안드로이드 스토어용 앱 파일(AAB) 만들기

Google Play에는 서명된 AAB를 올린다. 서명은 두 겹이다.
- **업로드 키**: 내가 만들어 갖고 있는 키. 올리는 파일에 이 키로 서명한다.
- **앱 서명 키**: Google이 보관하는 진짜 키(Play 앱 서명). 사용자에게 가는 앱은 Google이 이 키로 다시 서명한다.
  업로드 키를 잃어버려도 Play Console에서 재설정할 수 있어 앱을 잃지 않는다.

키 파일과 비밀번호는 저장소·채팅에 올리지 않는다(`.gitignore`에 `*.jks`). GitHub 비밀(Secrets)에만 둔다.

### 1. 업로드 키 만들기 (내 PC에서 한 번)

PowerShell에서. 비밀번호는 두 번 물어본다. 길고 기억하기 쉬운 것으로 정하고 비밀번호 관리자나 종이에 적어 둔다.
`upload.jks`는 이 PC 밖(클라우드 개인 폴더, USB)에도 백업한다.

```powershell
cd $HOME\Desktop
& "C:\Program Files\Java\jdk-21.0.10\bin\keytool.exe" -genkeypair -v -keystore upload.jks -alias modori-upload -keyalg RSA -keysize 2048 -validity 10000
```

이름·조직을 물으면 아무거나(닉네임 등)로 채워도 된다. 마지막에 `yes`.

### 2. GitHub 비밀 4개 넣기

`gh` 명령은 값을 화면에 안 보이고 GitHub에 바로 올린다. 이름·비밀번호는 아래 자리에 직접 넣는다.

```powershell
cd $HOME\Desktop
[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload.jks")) | gh secret set ANDROID_KEYSTORE_BASE64 -R namjin22/modori
gh secret set ANDROID_KEYSTORE_PASSWORD -R namjin22/modori   # 실행하면 값을 물어본다(키 저장소 비밀번호)
gh secret set ANDROID_KEY_ALIAS -R namjin22/modori           # modori-upload
gh secret set ANDROID_KEY_PASSWORD -R namjin22/modori        # 키 비밀번호(keytool이 저장소와 같게 두라고 했다면 같은 값)
```

### 3. AAB 만들기

GitHub → Actions → android → Run workflow → **release 체크** → 실행. 끝나면 실행 화면 아래 Artifacts의 `modori-android-release`(zip 안에 `app-release.aab`)를 받는다.
`mobile-v1.0.0` 같은 태그를 올려도 만든다. 버전 코드는 실행 번호라 올릴 때마다 커진다(스토어 요구).

### 4. Play Console에 올리기

1. 테스트 → **내부 테스트** 또는 **비공개 테스트** → 새 버전 만들기.
2. Play 앱 서명을 물으면 **Google이 관리하는 키 사용**을 고른다. 처음 올리는 파일이 업로드 키로 서명된 것이라 Play가 자동으로 등록한다.
3. `app-release.aab`를 올리고, 버전 이름·메모를 적고 저장 → 검토 → 출시.
4. 테스터를 넣는다(비공개 테스트는 이메일 목록 또는 Google 그룹). 개인 계정은 비공개 테스트에서 12명 × 14일이 필요하다.

## 앱 아이콘·시작 화면

앱 로고(`app/icon.svg`)로 `node scripts/mobile-icons.mjs`가 만든다. 로고를 바꾸면 다시 돌리고 커밋한다.

## iOS (App Store·TestFlight)

맥이 없어도 된다. GitHub의 macOS 러너(`.github/workflows/ios.yml`)가 빌드·서명·업로드를 한다. 서명은 App Store Connect API 키
하나로 Xcode가 인증서와 프로비저닝 프로필을 알아서 만들고 관리한다(인증서 파일을 따로 만들어 넣지 않는다).

### 1. Apple Developer에서 (한 번)

1. **App ID**: Certificates, Identifiers & Profiles → Identifiers → + → App IDs → App. Bundle ID `site.modori.app`(Explicit).
   Capabilities에서 **Sign In with Apple**을 켠다.
2. **팀 ID**: Membership 화면의 Team ID(10자리). 아래 `APPLE_TEAM_ID`.
3. **App Store Connect 앱**: App Store Connect → 앱 → + → 새로운 앱. 플랫폼 iOS, 이름 모도리, 기본 언어 한국어,
   번들 ID `site.modori.app`, SKU 아무거나(예: modori).
4. **API 키**: App Store Connect → 사용자 및 액세스 → 통합 → App Store Connect API → 팀 키 → +. 이름 `github-actions`,
   액세스 **관리(Admin)**(배포 인증서를 만들려면 필요). `.p8` 파일은 **한 번만 받을 수 있다**. 키 ID와 위쪽의 발급자(Issuer) ID를 적어 둔다.

### 2. GitHub 비밀 4개 넣기 (웹 화면에서)

GitHub 저장소 → **Settings** → 왼쪽 **Secrets and variables** → **Actions** → **New repository secret**을 네 번 누른다.
Name에 아래 이름, Secret에 값을 붙여 넣고 **Add secret**.

| Name | Secret에 넣을 값 |
|---|---|
| `ASC_KEY_P8` | 받은 `AuthKey_키ID.p8` 파일을 메모장으로 열어 **전체**(`-----BEGIN PRIVATE KEY-----`부터 `-----END PRIVATE KEY-----`까지) 복사해 붙여 넣기 |
| `ASC_KEY_ID` | API 키의 키 ID(10자리) |
| `ASC_ISSUER_ID` | App Store Connect API 화면 위쪽의 발급자(Issuer) ID(긴 UUID) |
| `APPLE_TEAM_ID` | 팀 ID(10자리) |

`.p8`은 저장소·채팅에 올리지 않는다. 넣은 뒤 PC에서는 안전한 곳(비밀번호 관리자 등)에만 둔다.
(명령으로 넣고 싶으면 `gh secret set ASC_KEY_P8 -R namjin22/modori < AuthKey_키ID.p8`. 예전 방식인 `ASC_KEY_P8_BASE64`도 받는다.)

### 3. 빌드해서 TestFlight에 올리기

GitHub → Actions → ios → Run workflow → **upload 체크** → 실행(10분 안팎). `ios-v1.0.0` 같은 태그를 올려도 된다.
빌드 번호는 실행 번호, 버전은 `1.0.0`으로 고정(외부 테스트 심사가 새 버전 번호마다 다시 필요해서. 사용자에게 보이는 버전을 올릴 때만 `ios.yml`의 `MARKETING_VERSION`을 바꾼다). App Store는 Xcode 26(iOS 26 SDK) 이상으로 만든 앱만 받아서 워크플로가 러너의 가장 새 Xcode 26을 고른다(처음 업로드가 Xcode 16이라 거절됐다). 올라간 뒤 App Store Connect의 TestFlight 탭에서 처리가 끝나면(10~30분)
**내부 테스트**에 나를 넣어 iPhone의 TestFlight 앱으로 설치한다. 외부 테스터(친구)는 첫 빌드만 베타 심사(보통 하루)를 거친다.

upload를 끄고 돌리면 서명 없이 시뮬레이터용으로 빌드만 한다(비밀 없이 도는 확인용). `mobile/`을 고친 PR에서도 이것이 돈다.

### 4. Apple 로그인 켜기 (심사 전에 꼭)

Google 로그인이 있는 iOS 앱은 Apple 로그인도 함께 있어야 심사를 통과한다(지침 4.8). 웹 서버가 Apple 로그인을 맡는다.

1. Identifiers → + → **Services IDs**. 설명 `모도리 웹 로그인`, 식별자 `site.modori.web`. 만든 뒤 Sign In with Apple을 켜고 Configure:
   Primary App ID `site.modori.app`, Domains `modori.site`, Return URLs `https://modori.site/api/auth/callback/apple`.
2. Keys → + → 이름 `modori-signin`, **Sign In with Apple** 체크 → Configure에서 Primary App ID `site.modori.app` → 저장 후 `.p8` 받기(한 번만).
   API 키(위 1-4)와 다른 키다.
3. VM 터미널에서 아래 두 줄을 실행하면 묻는 대로 값을 넣고 앱을 다시 띄워 준다(`deploy/set-apple.sh`). `.env`를 직접 고치지 않아도 된다.

```
cd /opt/modori
curl -fsSLO https://raw.githubusercontent.com/namjin22/modori/main/deploy/set-apple.sh && bash set-apple.sh
```

물어보는 것: Services ID(`site.modori.web`), 팀 ID, 키 ID, 그리고 `.p8` 파일 내용 전체(붙여 넣은 뒤 빈 줄에서 Enter).
끝나면 "성공: 로그인 화면에 'Apple로 계속하기'가 보여요."가 나온다. 직접 `.env`를 고치고 싶다면 아래 네 값을 넣는다(키 내용은 줄바꿈을 `\n`으로 바꿔 한 줄로).

```
AUTH_APPLE_ID=site.modori.web
APPLE_TEAM_ID=팀 ID
APPLE_KEY_ID=Sign In with Apple 키의 ID
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----
```

넷이 다 있어야 로그인 화면에 "Apple로 계속하기"가 보인다. 하나라도 빠지거나 키가 틀리면 버튼을 숨기고 서버 로그에
`[auth] Apple` 오류를 남긴다(Google 로그인은 그대로 된다). client_secret(JWT)은 서버가 뜰 때마다 키로 새로 만든다(`lib/apple-secret.ts`).

### iOS 푸시 알림 켜기

> ⚠️ APNs 키의 환경(Environment)은 **Production**(또는 Sandbox & Production)이어야 한다. TestFlight·App Store 앱은 운영 알림 서버를 쓴다. 처음 Sign in with Apple 키에 APNs를 Sandbox로 켜 두었다가 `403 BadEnvironmentKeyInToken`으로 알림이 하나도 가지 않았다(2026-10-14). 지금은 알림 전용 키(`APNS_KEY_ID`·`APNS_PRIVATE_KEY`)를 따로 쓴다.

Firebase 없이 서버가 Apple 푸시 서버(APNs)에 직접 보낸다(`lib/apns.ts`). 따로 만들 것은 없고, 위 4절의 **Sign in with Apple 키를 만들 때 "Apple Push Notifications service (APNs)"도 함께 체크**하면 같은 키·같은 `.env` 값(`APPLE_TEAM_ID`·`APPLE_KEY_ID`·`APPLE_PRIVATE_KEY`)으로 알림도 보낸다.
이미 만든 키라면 Keys에서 그 키를 열어 APNs를 체크해 저장하면 된다(키 파일은 다시 받지 않아도 된다). 앱 ID(`site.modori.app`)의 Push Notifications 기능은 빌드할 때 Xcode가 자동으로 켠다.
다른 키를 쓰고 싶으면 `.env`에 `APNS_KEY_ID`·`APNS_PRIVATE_KEY`를 따로 넣는다. 키가 없으면 iOS 알림만 조용히 건너뛴다.

### 아직 안 되는 것

- 실제 iPhone에서 로그인 넘겨받기·화면 여백(노치)을 아직 보지 못했다. 첫 TestFlight 빌드에서 확인한다.
- 스토어 소개·스크린샷(6.7"/6.9" iPhone)·개인정보 라벨(App Privacy)은 App Store Connect에서 직접 적는다(`docs/store-listing.md` 참고).

