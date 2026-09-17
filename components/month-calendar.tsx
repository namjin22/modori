import Link from "next/link";

import { DayMark } from "@/components/day-mark";

import {
  addMonths,
  daysInMonthKST,
  formatKST,
  formatMonthKST,
  isSameKSTDate,
  parseKSTDate,
  weekdayKST,
} from "@/lib/date";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
// 한 칸에 이름을 몇 개까지 보여줄지. 넘치면 "+n"으로 접는다.
const MAX_CHIPS = 3;

export type DoneItem = { content: string; color: string };

/** 달력 한 칸에 필요한 요약. 할 일이 없는 날은 넘기지 않아도 된다. */
export type DaySummary = {
  total: number;
  done: DoneItem[];
};

/** 완료한 일의 색을 겹치지 않게 모은다. 클로버 잎을 칠하는 데 쓴다. */
function uniqueColors(items: DoneItem[]): string[] {
  return [...new Set(items.map((item) => item.color))];
}

/**
 * 한 달 달력. 칸마다 클로버 표시로 그 날 한 일이 있는지 보여주고,
 * 넓은 화면에서는 완료한 할 일 이름도 카테고리 색 칩으로 덧붙인다.
 * 좁은 화면에서는 칸이 좁아 칩이 뭉개지므로 클로버만 둔다.
 * 링크 주소는 부르는 쪽이 정한다. 넓은 화면과 좁은 화면이 붙이는 쿼리가 다르다.
 */
export function MonthCalendar({
  monthStart,
  selected,
  today,
  summaries,
  dayHref,
  monthHref,
}: {
  monthStart: Date;
  selected: Date;
  today: Date;
  summaries: Map<string, DaySummary>;
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
    (sum, day) => sum + (summaries.get(formatKST(day))?.done.length ?? 0),
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
            const items = summary?.done ?? [];
            const isToday = isSameKSTDate(day, today);
            const isSelected = isSameKSTDate(day, selected);

            return (
              <Link
                key={key}
                href={dayHref(key)}
                // 한 달치 날짜 칸이 서른 개다. 미리 받으면 서버가 같은 화면을 서른 번 그린다.
                prefetch={false}
                aria-label={`${day.getUTCDate()}일, 완료 ${items.length > 0 ? "있음" : "없음"}`}
                aria-current={isSelected ? "date" : undefined}
                className="flex min-h-14 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 transition-colors hover:bg-surface-hover"
              >
                <DayMark
                  colors={uniqueColors(items)}
                  allDone={!!summary && summary.total > 0 && items.length === summary.total}
                />
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

                <span aria-hidden className="hidden w-full flex-col gap-px lg:flex">
                  {items.slice(0, MAX_CHIPS).map((item, index) => (
                    <span
                      key={`${item.content}-${index}`}
                      className="truncate rounded px-1 text-[10px] font-medium leading-[15px] text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.content}
                    </span>
                  ))}
                  {items.length > MAX_CHIPS && (
                    <span className="text-[10px] leading-[15px] text-muted">
                      +{items.length - MAX_CHIPS}
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
