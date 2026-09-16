import type { Routine } from "@prisma/client";

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
