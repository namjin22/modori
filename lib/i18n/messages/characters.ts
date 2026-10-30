import { defineMessages } from "@/lib/i18n";

/** 캐릭터 이름(lib/characters.ts의 id가 열쇠다). 도리·몽이·하루·펭이는 소리 나는 대로 옮겼다. */
export const characterNames = defineMessages({
  ko: { dori: "도리", mong: "몽이", haru: "하루", peng: "펭이" },
  en: { dori: "Dori", mong: "Mongi", haru: "Haru", peng: "Pengi" },
  ja: { dori: "ドリ", mong: "モンイ", haru: "ハル", peng: "ペンイ" },
});
