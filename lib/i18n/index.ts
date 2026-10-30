/**
 * 화면 언어(2026-10-30 운영자 요청). 한국어가 기본이고 영어·일본어를 고를 수 있다.
 * 라이브러리 없이 직접 만들었다(CLAUDE.md 규칙 6: 새 의존성은 먼저 묻는다). 글은 화면 영역마다 한 파일(lib/i18n/messages/)에 세 언어를 나란히 둔다.
 * 한국어를 기준으로 영어·일본어의 열쇠가 빠지거나 남으면 타입 검사에서 걸린다(defineMessages).
 *
 * 사용자가 적은 글(할 일, 카테고리 이름, 닉네임, 메모)과 약관·방침, 운영자 화면은 번역하지 않는다(docs/decisions.md "화면 언어").
 */
export const LOCALES = ["ko", "en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko";

/** 고른 언어를 적어 두는 쿠키. 로그인 전 화면도 이 언어로 그리려면 계정이 아니라 기기에 먼저 있어야 한다. */
export const LOCALE_COOKIE = "locale";

/** 언어 이름은 그 언어의 글자로 적는다(영어로 바꿔 놓고 한국어로 돌아갈 길을 잃지 않게). */
export const LOCALE_NAMES: Record<Locale, string> = { ko: "한국어", en: "English", ja: "日本語" };

/** Intl과 <html lang>에 넘기는 이름. */
export const INTL_LOCALE: Record<Locale, string> = { ko: "ko-KR", en: "en-US", ja: "ja-JP" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function localeOrDefault(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export type Vars = Record<string, string | number>;
export type MessageBundle<K extends string = string> = Record<Locale, Record<K, string>>;
export type Translate<K extends string = string> = (key: K, vars?: Vars) => string;

/**
 * 한 화면 영역의 글. 한국어의 열쇠가 기준이고, 영어·일본어에 같은 열쇠가 모두 있어야 한다(없거나 남으면 타입 오류).
 * 글 안의 {이름}은 부르는 쪽이 vars로 채운다.
 */
export function defineMessages<T extends Record<string, string>>(bundle: {
  ko: T;
  en: Record<keyof T, string>;
  ja: Record<keyof T, string>;
}): MessageBundle<keyof T & string> {
  return bundle as MessageBundle<keyof T & string>;
}

export function translate<K extends string>(bundle: MessageBundle<K>, locale: Locale, key: K, vars?: Vars): string {
  const text = bundle[locale][key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

export function translator<K extends string>(bundle: MessageBundle<K>, locale: Locale): Translate<K> {
  return (key, vars) => translate(bundle, locale, key, vars);
}
