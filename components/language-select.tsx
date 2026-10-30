"use client";

import { unstable_rethrow } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { setLocale } from "@/app/locale-actions";
import { useLocale, useT } from "@/components/locale-provider";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n";
import { language } from "@/lib/i18n/messages/language";

/**
 * 화면 언어 고르기. 로그인 화면과 마이페이지에 있다. 누르면 바로 바뀌고 서버에는 뒤따라 저장한다.
 * 이름은 항상 그 언어의 글자로 보인다(영어로 바꿔 놓고 한국어로 돌아갈 길을 잃지 않게).
 */
export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const current = useLocale();
  const t = useT(language);
  const [shown, setShown] = useOptimistic<Locale, Locale>(current, (_before, next) => next);
  const [, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === shown) return;
    startTransition(async () => {
      setShown(next);
      try {
        const result = await setLocale(next);
        if (!result.ok) throw new Error("언어 값이 올바르지 않다.");
      } catch (error) {
        // 로그인 화면에는 알림(토스트)이 없다. 저장하지 못하면 고른 표시가 원래 언어로 돌아가는 것으로 알린다.
        unstable_rethrow(error);
        console.error("[locale] 언어를 바꾸지 못했다.", error);
      }
    });
  }

  return (
    // 라디오가 아니라 눌림 단추로 둔다(aria-pressed). 마이페이지의 라디오는 테마 둘뿐이라는 기존 화면 시험과 겹치지 않는다.
    <div
      role="group"
      aria-label={t("label")}
      data-language-select
      className={compact ? "flex items-center gap-0.5 text-xs" : "flex gap-1 rounded-xl bg-surface-hover p-1 text-sm"}
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          aria-pressed={shown === locale}
          lang={locale}
          onClick={() => choose(locale)}
          className={`rounded-lg font-medium transition-colors ${compact ? "h-8 px-1.5" : "h-10 flex-1 px-3"} ${
            shown === locale
              ? compact
                ? "font-semibold text-foreground"
                : "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          {LOCALE_NAMES[locale]}
        </button>
      ))}
    </div>
  );
}
