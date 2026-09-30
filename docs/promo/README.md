# 홍보 영상

실제 앱 화면(데모 계정)을 자동으로 조작해 녹화하고, FFmpeg로 자막과 배경 음악을 얹어 mp4까지 만든다.
새 npm 의존성은 없다(Playwright 내장 녹화 + PC에 설치한 FFmpeg).

```bash
npm run promo        # 화면 녹화 → docs/promo/modori-promo.webm, 자막 그림, timeline.json (약 1분)
npm run promo:edit   # 자막·음악을 얹어 docs/promo/modori-promo.mp4 (1080×1920, 약 27초)
```

- 처음 한 번 FFmpeg를 설치한다: `winget install Gyan.FFmpeg` (설치 뒤 터미널을 새로 연다).
- 테스트 DB에 데모 계정("모도리", "도리친구")을 만들어 찍고 지운다. 운영 화면은 찍지 않는다(`tests/screenshots/seed.ts`).
- 장면·자막 문구는 `tests/screenshots/promo.spec.ts`(`CAPTIONS`, `beat` 시간), 합치는 방법은 `scripts/promo-edit.mjs`. 장면 시작 시각은 녹화할 때 `timeline.json`에 적혀 자막이 알아서 맞는다.
- 배경 음악은 직접 만든 잔잔한 화음이라 저작권 걱정이 없다. 더 나은 곡을 쓰려면 `MUSIC=곡파일경로 npm run promo:edit`(저작권 없는 곡만).
- 결과물(webm·mp4·자막 그림)은 저장소에 올리지 않는다(`.gitignore`). 필요할 때 다시 만든다.

## 애니메이션 버전 (모션 그래픽)

앱 화면 녹화 대신, 코드로 그린 30초 모션 그래픽 광고. "색이 채워지는 하루" 콘셉트(`ai-video-prompts.md`)를 그대로 따른다.
실사 촬영이나 AI 영상이 아니라 벡터 그림이라 사람 얼굴은 나오지 않고 도리 캐릭터가 나온다.

```bash
npm run promo:anim   # docs/promo/modori-promo-anim.mp4 (1080×1920, 30초, 30fps, 렌더링 약 3분)
PREVIEW=2.5,12,28 npm run promo:anim   # 시각(초)만 PNG로 뽑아 미리 본다(영상은 안 만든다)
```

- 장면은 `scripts/promo-anim/scene.html`(시각 t를 받아 그림을 돌려주는 함수), 장면 시각과 효과음 시각은 `timeline.mjs`, 음악·효과음은 `music.mjs`(코드로 만든 소리, 저작권 없음).
- 문구를 바꾸려면 `scene.html`의 `kinetic([...])` 단어들을 고친다.

## 올리기

YouTube에 올린다(공개 또는 일부 공개, 광고 끔, 연령 제한 없음). Play Console 스토어 등록정보의 "동영상" 칸에 주소를 넣는다.
푸시 알림·타이머·일기·AI는 영상에서 말하지 않는다(없는 기능이거나 제외 기능).
