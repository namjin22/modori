import { toKSTDateOnly } from "@/lib/date";
import type { Locale } from "@/lib/i18n";

/**
 * 날짜·시각을 화면 언어에 맞게 적는다. 날짜는 시각 없는 값(UTC 자정 Date, lib/date.ts)이라 시간대 계산 없이 년·월·일 숫자만 쓴다.
 * Intl을 쓰지 않고 표로 두었다: 서버와 브라우저가 같은 글자를 내고(하이드레이션이 어긋나지 않는다), 시험이 글자를 그대로 비교할 수 있다.
 */
const WEEKDAYS = {
  ko: { short: ["일", "월", "화", "수", "목", "금", "토"], long: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] },
  en: {
    short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    long: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
  ja: { short: ["日", "月", "火", "水", "木", "金", "土"], long: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"] },
} as const;

const EN_MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EN_MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** 0(일)~6(토)의 요일 이름. short는 "금"·"Fri"·"金", long은 "금요일"·"Friday"·"金曜日". */
export function weekdayName(locale: Locale, weekday: number, style: "short" | "long" = "short"): string {
  return WEEKDAYS[locale][style][weekday] ?? "";
}

/** 한 주의 요일 이름(일요일부터). 달력의 머리줄과 요일 고르기에 쓴다. */
export function weekdayNames(locale: Locale, style: "short" | "long" = "short"): readonly string[] {
  return WEEKDAYS[locale][style];
}

/** 달 이름 1~12. 달 고르기 단추에 쓴다: "10월"·"Oct"·"10月". */
export function monthName(locale: Locale, month: number): string {
  return locale === "en" ? (EN_MONTHS_SHORT[month - 1] ?? "") : locale === "ja" ? `${month}月` : `${month}월`;
}

/** 짧은 날짜: "10월 30일"·"Oct 30"·"10月30日". */
export function monthDay(locale: Locale, month: number, day: number): string {
  if (locale === "en") return `${EN_MONTHS_SHORT[month - 1]} ${day}`;
  return locale === "ja" ? `${month}月${day}日` : `${month}월 ${day}일`;
}

/** 년을 붙인 날짜: "2026년 10월 2일"·"Oct 2, 2026"·"2026年10月2日". */
export function fullDate(locale: Locale, year: number, month: number, day: number): string {
  if (locale === "en") return `${EN_MONTHS_SHORT[month - 1]} ${day}, ${year}`;
  return locale === "ja" ? `${year}年${month}月${day}日` : `${year}년 ${month}월 ${day}일`;
}

/** 년과 달: "2026년 10월"·"October 2026"·"2026年10月". */
export function yearMonth(locale: Locale, year: number, month: number): string {
  if (locale === "en") return `${EN_MONTHS_LONG[month - 1]} ${year}`;
  return locale === "ja" ? `${year}年${month}月` : `${year}년 ${month}월`;
}

/** 년: "2026년"·"2026"·"2026年". */
export function yearOnly(locale: Locale, year: number): string {
  return locale === "en" ? String(year) : locale === "ja" ? `${year}年` : `${year}년`;
}

/** 날짜와 요일 제목: "10월 30일 금요일"·"Friday, Oct 30"·"10月30日 金曜日". */
export function dayHeading(locale: Locale, month: number, day: number, weekday: number): string {
  const name = weekdayName(locale, weekday, "long");
  if (locale === "en") return `${name}, ${monthDay(locale, month, day)}`;
  return `${monthDay(locale, month, day)} ${name}`;
}

/** 요일을 괄호에 붙인 긴 날짜: "2026년 10월 2일 (금)"·"Oct 2, 2026 (Fri)"·"2026年10月2日 (金)". */
export function fullDateWithWeekday(locale: Locale, year: number, month: number, day: number, weekday: number): string {
  return `${fullDate(locale, year, month, day)} (${weekdayName(locale, weekday)})`;
}

/** 요일을 붙인 짧은 날짜: "10월 30일 (금)"·"Oct 30 (Fri)"·"10月30日 (金)". */
export function monthDayWithWeekday(locale: Locale, month: number, day: number, weekday: number): string {
  return `${monthDay(locale, month, day)} (${weekdayName(locale, weekday)})`;
}

/** 날짜 값(UTC 자정 Date)을 짧은 날짜로. lib/date.ts의 formatMonthDayKST를 화면 언어로 옮긴 것이다. */
export function formatMonthDay(locale: Locale, date: Date): string {
  const day = toKSTDateOnly(date);
  return monthDay(locale, day.getUTCMonth() + 1, day.getUTCDate());
}

/** 하루의 시각(자정부터 몇 분): "오전 6:00"·"6:00 AM"·"午前6:00". */
export function clock(locale: Locale, minute: number): string {
  const hour = Math.floor(minute / 60);
  const rest = String(minute % 60).padStart(2, "0");
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  const pm = hour >= 12;
  if (locale === "en") return `${shown}:${rest} ${pm ? "PM" : "AM"}`;
  if (locale === "ja") return `${pm ? "午後" : "午前"}${shown}:${rest}`;
  return `${pm ? "오후" : "오전"} ${shown}:${rest}`;
}
