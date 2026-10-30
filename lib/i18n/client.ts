import { LOCALE_COOKIE, localeOrDefault, translator, type Locale, type MessageBundle, type Translate } from "@/lib/i18n";

/**
 * 렌더 밖(이벤트 처리기, 서버 동작을 감싼 함수)의 브라우저 코드가 지금 화면 언어를 알아내는 길.
 * <html lang>이 고른 언어이므로(app/layout.tsx) 훅을 쓸 수 없는 곳에서는 이것을 읽는다. 렌더 중에는 components/locale-provider.tsx의 useT를 쓴다.
 */
export function pageLocale(): Locale {
  return typeof document === "undefined" ? localeOrDefault(null) : localeOrDefault(document.documentElement.lang);
}

/**
 * 쿠키에 적힌 언어. <html lang>을 믿을 수 없는 곳(맨 바깥 레이아웃이 깨져 대신 뜨는 app/global-error.tsx)이 쓴다.
 * 언어는 개인정보가 아닌 화면 설정이라 쿠키를 브라우저 코드가 읽을 수 있게 열어 두었다(app/locale-actions.ts).
 */
export function cookieLocale(): Locale {
  if (typeof document === "undefined") return localeOrDefault(null);
  const found = document.cookie.split("; ").find((part) => part.startsWith(`${LOCALE_COOKIE}=`));
  return localeOrDefault(found?.slice(LOCALE_COOKIE.length + 1));
}

export function pageT<K extends string>(bundle: MessageBundle<K>): Translate<K> {
  return translator(bundle, pageLocale());
}
