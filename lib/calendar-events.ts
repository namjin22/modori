import type { CalendarEvent } from "@/components/month-calendar";
import { addDays, formatKST } from "@/lib/date";

type SpreadEvent = { id: string; title: string; color: string; startDate: Date; endDate: Date; repeat?: unknown };

/** 여러 날에 걸친 일정을 달력의 각 날짜에 펼쳐 놓는다. 이번 달 밖은 버린다. 홈과 친구 화면이 같이 쓴다. */
export function spreadEvents(events: SpreadEvent[], monthStart: Date, monthEnd: Date): Map<string, CalendarEvent[]> {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    let day = event.startDate < monthStart ? monthStart : event.startDate;
    const last = event.endDate > monthEnd ? monthEnd : event.endDate;
    while (day <= last) {
      const key = formatKST(day);
      byDate.set(key, [
        ...(byDate.get(key) ?? []),
        { id: event.id, title: event.title, color: event.color, start: formatKST(event.startDate), end: formatKST(event.endDate), fixed: Boolean(event.repeat) },
      ]);
      day = addDays(day, 1);
    }
  }
  return byDate;
}
