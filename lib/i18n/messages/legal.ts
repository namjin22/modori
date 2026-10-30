import { defineMessages } from "@/lib/i18n";

/** 개인정보처리방침·이용약관은 한국어가 원본이다. 영어·일본어 화면에는 그 사실만 알린다(docs/decisions.md "화면 언어"). */
export const legal = defineMessages({
  ko: { koreanOnly: "" },
  en: { koreanOnly: "This document is provided in Korean only. The Korean text is the official version." },
  ja: { koreanOnly: "この文書は韓国語のみで提供されます。韓国語の文面が正本です。" },
});
