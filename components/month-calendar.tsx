import Link from "next/link";


import {
  addMonths,
  daysInMonthKST,
  formatKST,
  formatMonthKST,
  isSameKSTDate,
  parseKSTDate,
  weekdayKST,
} from "@/lib/date";
import { dayFillStyle } from "@/lib/colors";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
// 한 칸에 이름을 몇 개까지 보여줄지. 넘치면 "+n"으로 접는다.
const MAX_CHIPS = 3;

/** 달력 한 칸에 필요한 요약. 할 일이 없는 날은 넘기지 않아도 된다. */
export type DaySummary = {
  total: number;
  // 완료한 할 일의 색. 할 일 순서대로.
  doneColors: string[];
};

/** 달력에 이름으로 보일 일정. */
export type CalendarEvent = { id: string; title: string; color: string };

/**
 * 한 달 달력. 칸에는 일정 이름만 글자로 보이고, 할 일은 글자 대신
 * 완료한 만큼 그 색으로 칸을 아래부터 채운다. 둘을 섞으면 칸이 금방 넘친다.
 * 링크 주소는 부르는 쪽이 정한다. 넓은 화면과 좁은 화면이 붙이는 쿼리가 다르다.
 */
export function MonthCalendar({
  monthStart,
  selected,
  today,
  summaries,
  eventsByDate,
  dayHref,
  monthHref,
}: {
  monthStart: Date;
  selected: Date;
  today: Date;
  summaries: Map<string, DaySummary>;
  eventsByDate: Map<string, CalendarEvent[]>;
  dayHref: (dateKey: string) => string;
  monthHref: (monthKey: string) => string;
}) {
  const monthKey = formatMonthKST(monthStart);
  const [year, month] = monthKey.split("-");
  const leadingBlanks = weekdayKST(monthStart);
  const days = Array.from({ length: daysInMonthKST(monthStart) }, (_, index) =>
    parseKSTDate(`${monthKey}-${String(index + 1).padStart(2, "0")}`),
  );
  const doneCount = days.reduce(
    (sum, day) => sum + (summaries.get(formatKST(day))?.doneColors.length ?? 0),
    0,
  );
  const isThisMonth = monthKey === formatMonthKST(today);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {Number(year)}년 {Number(month)}월
        </h2>
        <div className="flex items-center gap-1">
          {!isThisMonth && (
            <Link
              href={monthHref(formatMonthKST(today))}
              className="rounded-full px-3 py-1 text-xs text-brand hover:bg-surface-hover"
            >
              이번 달
            </Link>
          )}
          <Link
            href={monthHref(formatMonthKST(addMonths(monthStart, -1)))}
            aria-label="이전 달"
            className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-hover"
          >
            ‹
          </Link>
          <Link
            href={monthHref(formatMonthKST(addMonths(monthStart, 1)))}
            aria-label="다음 달"
            className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-hover"
          >
            ›
          </Link>
        </div>
      </header>

      <div className="rounded-2xl bg-surface p-2">
        <div className="grid grid-cols-7 text-center text-xs">
          {WEEKDAY_NAMES.map((name, index) => (
            <div
              key={name}
              className={`py-2 ${
                index === 0
                  ? "text-red-400"
                  : index === 6
                    ? "text-blue-400"
                    : "text-muted"
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: leadingBlanks }, (_, index) => (
            <div key={`blank-${index}`} />
          ))}

          {days.map((day) => {
            const key = formatKST(day);
            const summary = summaries.get(key);
            const doneColors = summary?.doneColors ?? [];
            const events = eventsByDate.get(key) ?? [];
            const isToday = isSameKSTDate(day, today);
            const isSelected = isSameKSTDate(day, selected);

            return (
              <Link
                key={key}
                href={dayHref(key)}
                // 한 달치 날짜 칸이 서른 개다. 미리 받으면 서버가 같은 화면을 서른 번 그린다.
                prefetch={false}
                aria-label={`${day.getUTCDate()}일, 완료 ${doneColors.length > 0 ? "있음" : "없음"}`}
                aria-current={isSelected ? "date" : undefined}
                style={dayFillStyle(doneColors, summary?.total ?? 0)}
                className="flex min-h-16 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 transition-colors hover:bg-surface-hover"
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-xs ${
                    isSelected
                      ? "bg-foreground font-bold text-background"
                      : isToday
                        ? "font-bold text-brand"
                        : "text-foreground"
                  }`}
                >
                  {day.getUTCDate()}
                </span>

                <span aria-hidden className="flex w-full flex-col gap-px">
                  {events.slice(0, MAX_CHIPS).map((event) => (
                    <span
                      key={event.id}
                      className="truncate rounded px-1 text-[10px] font-medium leading-[15px] text-white"
                      style={{ backgroundColor: event.color }}
                    >
                      {event.title}
                    </span>
                  ))}
                  {events.length > MAX_CHIPS && (
                    <span className="text-[10px] leading-[15px] text-muted">
                      +{events.length - MAX_CHIPS}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <p className="text-center text-sm text-muted">이번 달 완료 {doneCount}개</p>
    </section>
  );
}
