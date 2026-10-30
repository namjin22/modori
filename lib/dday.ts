import { daysBetween } from "@/lib/date";
import type { Locale } from "@/lib/i18n";

/** 여러 날짜리의 가운데에 보이는 말. */
export function ddayOngoing(locale: Locale): string {
  return locale === "en" ? "Ongoing" : locale === "ja" ? "進行中" : "진행 중";
}

/** 오늘이거나 진행 중이라 눈에 띄어야 하는 표시인가. */
export function isSoonDday(label: string, locale: Locale): boolean {
  return label === "D-DAY" || label === ddayOngoing(locale);
}

/**
 * 일정까지 며칠 남았는지. 시험이 언제인지는 그 날짜를 열어봐야 알 수 있었는데,
 * 남은 날을 붙이면 목록만 보고도 알 수 있다.
 *
 * 시작 전이면 D-n, 시작한 날이면 D-DAY, 여러 날짜리의 가운데면 "진행 중",
 * 끝난 일정이면 null이다. 끝난 일정에 D+를 붙이면 지난 기록을 볼 때마다
 * 화면이 숫자로 뒤덮인다.
 */
export function ddayLabel(
  startDate: Date,
  endDate: Date,
  today: Date,
  locale: Locale = "ko",
): string | null {
  const untilStart = daysBetween(today, startDate);
  if (untilStart > 0) return `D-${untilStart}`;
  if (untilStart === 0) return "D-DAY";

  return daysBetween(today, endDate) >= 0 ? ddayOngoing(locale) : null;
}
