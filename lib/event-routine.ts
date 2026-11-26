import type { EventRoutine } from "@prisma/client";

import { addDays, daysBetween, formatKST } from "@/lib/date";
import type { Locale } from "@/lib/i18n";
import { describeRoutineRule, matchesRule } from "@/lib/routine";

/**
 * 반복 일정(EventRoutine)을 기간 안의 날짜로 펼친다. 반복 일정은 날마다 줄을 만들지 않고 규칙만 둔다(prisma/schema.prisma).
 * 규칙 판정은 할 일 루틴과 같은 matchesRule을 쓴다(멈춤·시작일·종료일·요일·날짜).
 */
export type EventRoutineRule = Pick<
  EventRoutine,
  "id" | "title" | "color" | "startTime" | "endTime" | "freq" | "byWeekday" | "byMonthday" | "startDate" | "endDate" | "pausedAt"
>;

/** 펼친 하루치. 홈의 일정 목록·달력이 보통 일정과 같은 모양으로 그리고, repeat로 반복 일정인 것을 안다. */
export type EventOccurrence = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  startTime: number | null;
  endTime: number | null;
  color: string;
  memo: null;
  dday: false;
  repeat: { routineId: string; date: string; rule: string };
};

// 한 화면이 받는 기간(한 달 남짓)보다 넉넉한 상한. 잘못된 기간이 와도 서버가 날짜를 끝없이 돌지 않게 한다.
const MAX_SPAN_DAYS = 400;

/** 같은 날 반복 일정끼리는 시각순(하루 종일이 먼저), 같으면 이름순. */
function byTime(a: EventOccurrence, b: EventOccurrence): number {
  const at = a.startTime ?? -1;
  const bt = b.startTime ?? -1;
  return at - bt || a.title.localeCompare(b.title, "ko");
}

export function expandEventRoutines(
  routines: EventRoutineRule[],
  skips: { eventRoutineId: string; date: Date }[],
  from: Date,
  to: Date,
  locale: Locale = "ko",
): EventOccurrence[] {
  const skipped = new Set(skips.map((skip) => `${skip.eventRoutineId}:${formatKST(skip.date)}`));
  const span = Math.min(daysBetween(from, to), MAX_SPAN_DAYS);
  const result: EventOccurrence[] = [];
  for (let offset = 0; offset <= span; offset += 1) {
    const day = addDays(from, offset);
    const key = formatKST(day);
    const today: EventOccurrence[] = [];
    for (const routine of routines) {
      if (!matchesRule(routine, day) || skipped.has(`${routine.id}:${key}`)) continue;
      today.push({
        id: `${routine.id}:${key}`,
        title: routine.title,
        startDate: day,
        endDate: day,
        startTime: routine.startTime,
        endTime: routine.endTime,
        color: routine.color,
        memo: null,
        dday: false,
        repeat: { routineId: routine.id, date: key, rule: describeRoutineRule(routine, locale) },
      });
    }
    result.push(...today.sort(byTime));
  }
  return result;
}
