# 홍보 영상

실제 앱 화면(데모 계정)을 자동으로 조작해 녹화한다. 새 의존성은 없다(Playwright 내장 녹화).

```bash
npm run promo    # docs/promo/modori-promo.webm (세로 810×1440, 약 30초)
```

- 테스트 DB에 데모 계정("모도리", "도리친구")을 만들어 찍고 지운다. 운영 화면은 찍지 않는다(`tests/screenshots/seed.ts`).
- 화면에는 자막을 넣지 않았다. 아래 `captions.md`의 자막을 편집 앱에서 얹는다.
- 결과 파일은 저장소에 올리지 않는다(`.gitignore`). 필요할 때 다시 만든다.
- 장면을 바꾸려면 `tests/screenshots/promo.spec.ts`를 고친다. 기다리는 시간(`beat`)이 장면 길이다.

## 편집

1. CapCut(무료) 등에서 `modori-promo.webm`을 불러와 9:16 프로젝트로 만든다.
2. `captions.md`의 자막을 장면 시각에 맞춰 얹는다.
3. 저작권 없는 배경 음악만 쓴다(유튜브 오디오 라이브러리 등).
4. mp4로 내보내 YouTube에 올린다(공개 또는 일부 공개, 광고 끔, 연령 제한 없음). Play Console 스토어 등록정보의 "동영상" 칸에 주소를 넣는다.

FFmpeg가 있다면 웹엠을 mp4로 바꾸는 한 줄(자막·음악은 편집 앱이 편하다):

```bash
ffmpeg -i docs/promo/modori-promo.webm -c:v libx264 -pix_fmt yuv420p -r 30 modori-promo.mp4
```
