import { addDays, daysBetween } from "@/lib/date";

type Range = { startDate: Date; endDate: Date };

/**
 * 새 일정(start~end)을 넣으면 일정이 max개를 넘는 첫 날. 없으면 null.
 *
 * 여러 날 일정은 기간 안의 날마다 따로 센다. 달력 한 칸과 그날 목록에 보이는 것이 "그날 일정"이라,
 * 시작일만 세면 긴 일정 여섯 개가 한 날에 겹쳐 보일 수 있다. existing에는 새 일정과 겹치는 것만 넘기면 된다.
 */
export function firstOverfullDay(
  existing: Range[],
  start: Date,
  end: Date,
  max: number,
): Date | null {
  const days = daysBetween(start, end);
  for (let offset = 0; offset <= days; offset += 1) {
    const day = addDays(start, offset);
    const covering = existing.filter(
      (event) => daysBetween(event.startDate, day) >= 0 && daysBetween(day, event.endDate) >= 0,
    ).length;
    if (covering >= max) return day;
  }
  return null;
}
