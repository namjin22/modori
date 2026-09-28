import { formatMonthDayKST, isSameKSTDate } from "@/lib/date";

/**
 * 일정 시각. DB에는 자정부터 몇 분인지(0~1439)로 두고, 화면과 폼은 "HH:MM"으로 주고받는다.
 * 날짜를 시각 없는 값으로 두는 규칙(lib/date.ts)을 깨지 않으려고 시각을 따로 둔다.
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "HH:MM" → 분. 비었으면 null, 형식이 틀리면 undefined. */
export function parseTime(value: string): number | null | undefined {
  if (value === "") return null;
  const match = TIME_PATTERN.exec(value);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 분 → "HH:MM". */
export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

type EventWhen = {
  startDate: Date;
  endDate: Date;
  startTime: number | null;
  endTime: number | null;
};

/**
 * 일정 줄 아래에 적는 때. 하루 종일인 하루짜리 일정은 적을 것이 없어 null.
 * 하루짜리: "09:00", "09:00 ~ 10:30". 여러 날: "9월 28일 ~ 9월 30일", 시각이 있으면 날짜 뒤에 붙인다.
 */
export function describeEventWhen(event: EventWhen): string | null {
  const start = event.startTime === null ? null : formatTime(event.startTime);
  const end = event.endTime === null ? null : formatTime(event.endTime);

  if (isSameKSTDate(event.startDate, event.endDate)) {
    if (!start) return null;
    return end ? `${start} ~ ${end}` : start;
  }

  const from = [formatMonthDayKST(event.startDate), start].filter(Boolean).join(" ");
  const to = [formatMonthDayKST(event.endDate), end].filter(Boolean).join(" ");
  return `${from} ~ ${to}`;
}
