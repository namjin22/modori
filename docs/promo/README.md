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

## 올리기

YouTube에 올린다(공개 또는 일부 공개, 광고 끔, 연령 제한 없음). Play Console 스토어 등록정보의 "동영상" 칸에 주소를 넣는다.
푸시 알림·타이머·일기·AI는 영상에서 말하지 않는다(없는 기능이거나 제외 기능).
