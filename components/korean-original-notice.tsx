"use client";

import { useT } from "@/components/locale-provider";
import { legal } from "@/lib/i18n/messages/legal";

/**
 * 개인정보처리방침·이용약관은 한국 법에 맞춘 한국어가 원본이라 번역하지 않는다. 한국어가 아닌 화면에서는 맨 위에 그 사실을 알린다.
 * 번역을 넣으면 번역 오류가 법적 책임 문제가 될 수 있다(docs/decisions.md "화면 언어").
 */
export function KoreanOriginalNotice() {
  const t = useT(legal);
  const text = t("koreanOnly");
  if (!text) return null;
  return (
    <p role="note" className="rounded-xl bg-surface p-3 text-xs leading-relaxed text-muted">
      {text}
    </p>
  );
}
