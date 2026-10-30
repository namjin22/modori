import type { Routine } from "@prisma/client";

import type { Locale } from "@/lib/i18n";
import { weekdayName } from "@/lib/i18n/format";

import { daysBetween, toKSTDateOnly, weekdayKST } from "./date";

// 판정에 필요한 필드만 받는다. 테스트에서 Routine 전체를 만들지 않아도 되고,
// 나중에 다른 필드가 늘어도 이 함수는 영향을 받지 않는다.
export type RoutineRule = Pick<
  Routine,
  "freq" | "byWeekday" | "byMonthday" | "startDate" | "endDate" | "pausedAt"
>;

/** 이 루틴이 그 날짜에 할 일을 만들어야 하는가. */
export function matchesRule(routine: RoutineRule, date: Date): boolean {
  const target = toKSTDateOnly(date);

  if (routine.pausedAt !== null) return false;
  if (daysBetween(routine.startDate, target) < 0) return false;
  if (routine.endDate !== null && daysBetween(target, routine.endDate) < 0) {
    return false;
  }

  switch (routine.freq) {
    case "DAILY":
      return true;
    case "WEEKLY":
      return routine.byWeekday.includes(weekdayKST(target));
    case "MONTHLY":
      // 31일 루틴은 31일이 없는 달에 만들지 않는다. 말일로 당기지 않는다.
      return routine.byMonthday.includes(target.getUTCDate());
    default: {
      const unhandled: never = routine.freq;
      throw new Error(`알 수 없는 반복 주기다: ${String(unhandled)}`);
    }
  }
}

/** 반복 규칙을 사람이 읽는 말로. "매일", "매주 월·수", "매월 1·15일"(영어·일본어는 "Every day", "Every Mon, Wed", "毎週 月・水"). 할 일 루틴과 반복 일정이 같이 쓴다. */
export function describeRoutineRule(routine: Pick<Routine, "freq" | "byWeekday" | "byMonthday">, locale: Locale = "ko"): string {
  const join = locale === "en" ? ", " : locale === "ja" ? "・" : "·";
  if (routine.freq === "DAILY") return locale === "en" ? "Every day" : locale === "ja" ? "毎日" : "매일";
  if (routine.freq === "WEEKLY") {
    const days = routine.byWeekday
      .slice()
      .sort((a, b) => a - b)
      .map((day) => weekdayName(locale, day))
      .join(join);
    return locale === "en" ? `Every ${days}` : locale === "ja" ? `毎週 ${days}` : `매주 ${days}`;
  }
  const dates = routine.byMonthday
    .slice()
    .sort((a, b) => a - b)
    .join(join);
  return locale === "en" ? `Monthly on day ${dates}` : locale === "ja" ? `毎月 ${dates}日` : `매월 ${dates}일`;
}
