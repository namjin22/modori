# 안드로이드 스토어용 앱 파일(AAB) 만들기

Google Play에는 서명된 AAB를 올린다. 서명은 두 겹이다.
- **업로드 키**: 내가 만들어 갖고 있는 키. 올리는 파일에 이 키로 서명한다.
- **앱 서명 키**: Google이 보관하는 진짜 키(Play 앱 서명). 사용자에게 가는 앱은 Google이 이 키로 다시 서명한다.
  업로드 키를 잃어버려도 Play Console에서 재설정할 수 있어 앱을 잃지 않는다.

키 파일과 비밀번호는 저장소·채팅에 올리지 않는다(`.gitignore`에 `*.jks`). GitHub 비밀(Secrets)에만 둔다.

## 1. 업로드 키 만들기 (내 PC에서 한 번)

PowerShell에서. 비밀번호는 두 번 물어본다. 길고 기억하기 쉬운 것으로 정하고 비밀번호 관리자나 종이에 적어 둔다.
`upload.jks`는 이 PC 밖(클라우드 개인 폴더, USB)에도 백업한다.

```powershell
cd $HOME\Desktop
& "C:\Program Files\Java\jdk-21.0.10\bin\keytool.exe" -genkeypair -v -keystore upload.jks -alias modori-upload -keyalg RSA -keysize 2048 -validity 10000
```

이름·조직을 물으면 아무거나(닉네임 등)로 채워도 된다. 마지막에 `yes`.

## 2. GitHub 비밀 4개 넣기

`gh` 명령은 값을 화면에 안 보이고 GitHub에 바로 올린다. 이름·비밀번호는 아래 자리에 직접 넣는다.

```powershell
cd $HOME\Desktop
[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload.jks")) | gh secret set ANDROID_KEYSTORE_BASE64 -R namjin22/modori
gh secret set ANDROID_KEYSTORE_PASSWORD -R namjin22/modori   # 실행하면 값을 물어본다(키 저장소 비밀번호)
gh secret set ANDROID_KEY_ALIAS -R namjin22/modori           # modori-upload
gh secret set ANDROID_KEY_PASSWORD -R namjin22/modori        # 키 비밀번호(keytool이 저장소와 같게 두라고 했다면 같은 값)
```

## 3. AAB 만들기

GitHub → Actions → android → Run workflow → **release 체크** → 실행. 끝나면 실행 화면 아래 Artifacts의 `modori-android-release`(zip 안에 `app-release.aab`)를 받는다.
`mobile-v1.0.0` 같은 태그를 올려도 만든다. 버전 코드는 실행 번호라 올릴 때마다 커진다(스토어 요구).

## 4. Play Console에 올리기

1. 테스트 → **내부 테스트** 또는 **비공개 테스트** → 새 버전 만들기.
2. Play 앱 서명을 물으면 **Google이 관리하는 키 사용**을 고른다. 처음 올리는 파일이 업로드 키로 서명된 것이라 Play가 자동으로 등록한다.
3. `app-release.aab`를 올리고, 버전 이름·메모를 적고 저장 → 검토 → 출시.
4. 테스터를 넣는다(비공개 테스트는 이메일 목록 또는 Google 그룹). 개인 계정은 비공개 테스트에서 12명 × 14일이 필요하다.

## 앱 아이콘·시작 화면

앱 로고(`app/icon.svg`)로 `node scripts/mobile-icons.mjs`가 만든다. 로고를 바꾸면 다시 돌리고 커밋한다.
