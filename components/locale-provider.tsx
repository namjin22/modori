"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { DEFAULT_LOCALE, translator, type Locale, type MessageBundle, type Translate } from "@/lib/i18n";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** 서버가 정한 화면 언어를 브라우저 쪽 화면에 건넨다(app/layout.tsx). */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** 브라우저 쪽 화면의 글. 영역의 글(lib/i18n/messages/)을 넘기면 지금 언어의 글을 찾아 주는 함수를 돌려준다. */
export function useT<K extends string>(bundle: MessageBundle<K>): Translate<K> {
  const locale = useLocale();
  return useMemo(() => translator(bundle, locale), [bundle, locale]);
}
