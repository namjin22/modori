import Link from "next/link";

import { IntentLink } from "@/components/intent-link";
import { TouchGuard } from "@/components/touch-guard";
import type { ComponentProps, ReactNode } from "react";


import {
  addMonths,
  daysInMonthKST,
  formatKST,
  formatMonthKST,
  isSameKSTDate,
  parseKSTDate,
  weekdayKST,
} from "@/lib/date";
import { contrastTextColor } from "@/lib/colors";

import { DayFill } from "@/components/day-fill";
import { EventDragGrid } from "@/components/event-drag-grid";
import { SwapIn } from "@/components/swap-in";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
// 한 칸에 이름을 몇 개까지 보여줄지. 넘치면 "+n"으로 접는다.
const MAX_CHIPS = 3;

/** 달력 한 칸에 필요한 요약. 할 일이 없는 날은 넘기지 않아도 된다. */
export type DaySummary = {
  total: number;
  // 완료한 할 일의 색. 끝낸 순서대로(먼저 끝낸 것이 위).
  doneColors: string[];
};

/** 달력에 이름으로 보일 일정. start·end("YYYY-MM-DD")는 이름표를 끌어 기간을 바꿀 때 쓴다. */
export type CalendarEvent = { id: string; title: string; color: string; start: string; end: string };

/**
 * 한 달 달력. 칸에는 일정 이름만 글자로 보이고, 할 일은 글자 대신 날짜 아래 표시(DayFill)가
 * 완료한 만큼 그 색으로 아래부터 찬다. 이름까지 넣으면 칸이 금방 넘친다.
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
  compact = false,
  onSelectDay,
  editableEvents = false,
}: {
  // 홈처럼 한 달치를 이미 받아 둔 화면은 칸을 눌러도 서버에 가지 않고 이 함수로 날짜만 바꾼다(components/home-view.tsx).
  onSelectDay?: (dateKey: string) => void;
  // 내 달력에서만 일정 이름표를 끌어 기간을 바꾼다.
  editableEvents?: boolean;
  // 친구 화면처럼 일정 이름이 들어가지 않는 곳에서는 칸을 낮춰 한눈에 보이게 한다.
  compact?: boolean;
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
    // 폰에서는 달력이 첫 화면을 다 차지해 할 일이 안 보였다. 간격·칸 높이를 줄여 할 일을 위로 올린다(넓은 화면은 그대로).
    <section className="flex flex-col gap-2 sm:gap-4">
      <header className="flex items-center justify-between">
        <SwapIn swapKey={monthKey}>
          <h2 className="text-lg font-bold">
            {Number(year)}년 {Number(month)}월
          </h2>
        </SwapIn>
        <div className="flex items-center gap-1">
          {!isThisMonth && (
            <Link prefetch={false}
              href={monthHref(formatMonthKST(today))}
              className="rounded-full px-3 py-1 text-xs text-brand hover:bg-surface-hover"
            >
              이번 달
            </Link>
          )}
          <IntentLink
            href={monthHref(formatMonthKST(addMonths(monthStart, -1)))}
            aria-label="이전 달"
            className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-hover"
          >
            ‹
          </IntentLink>
          <IntentLink
            href={monthHref(formatMonthKST(addMonths(monthStart, 1)))}
            aria-label="다음 달"
            className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-hover"
          >
            ›
          </IntentLink>
        </div>
      </header>

      <div className="rounded-2xl bg-surface p-2">
        <div className="grid grid-cols-7 text-center text-xs">
          {WEEKDAY_NAMES.map((name, index) => (
            <div
              key={name}
              className={`py-1 sm:py-2 ${
                index === 0
                  ? "text-danger"
                  : index === 6
                    ? "text-brand"
                    : "text-muted"
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* 달을 넘기면 넘긴 쪽에서 날짜 칸이 미끄러져 들어온다. 요일 줄은 그대로 둔다. */}
        <SwapIn swapKey={monthKey}>
          <DayGrid editable={editableEvents}>
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
              const eventLabel = events.length
                ? `, 일정 ${events
                    .slice(0, MAX_CHIPS)
                    .map((event) => event.title)
                    .join(", ")}${events.length > MAX_CHIPS ? ` 외 ${events.length - MAX_CHIPS}개` : ""}`
                : "";

              return (
                <DayLink
                  key={key}
                  href={dayHref(key)}
                  onSelect={onSelectDay && (() => onSelectDay(key))}
                  aria-label={`${day.getUTCDate()}일, 완료 ${doneColors.length > 0 ? "있음" : "없음"}`}
                  aria-describedby={events.length ? `calendar-events-${key}` : undefined}
                  aria-current={isSelected ? "date" : undefined}
                  data-date={key}
                  // 일정 이름표를 끄는 동안 바뀔 기간의 칸(EventDragGrid가 붙인다).
                  className={`relative flex flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 transition-colors hover:bg-surface-hover data-[drag-range]:bg-brand-subtle data-[drag-range]:ring-1 data-[drag-range]:ring-brand/50 ${compact ? "min-h-10" : "min-h-11 sm:min-h-16"}`}
                >
                  <span
                    // 새로 고른 날은 동그라미가 한 번 튀어 올라 어디를 눌렀는지 보인다(클래스가 붙는 순간 한 번 돈다).
                    className={`flex size-6 items-center justify-center rounded-full text-xs transition-colors ${
                      isSelected
                        ? "animate-pop bg-foreground font-bold text-background"
                        : isToday
                          ? "font-bold text-brand"
                          : "text-foreground"
                    }`}
                  >
                    {day.getUTCDate()}
                  </span>

                  <DayFill
                    id={`month-fill-${key}`}
                    total={summary?.total ?? 0}
                    doneColors={doneColors}
                    size={compact ? 16 : 20}
                  />

                  <span aria-hidden className="flex w-full flex-col gap-px">
                    {events.slice(0, MAX_CHIPS).map((event) => (
                      <span
                        key={event.id}
                        data-event-id={editableEvents ? event.id : undefined}
                        data-event-start={event.start}
                        data-event-end={event.end}
                        title={editableEvents ? "끌어서 기간 바꾸기" : undefined}
                        // 마우스로 끌 때는 바로 잡는다. 손가락(pointer-coarse)은 쓸면 화면이 스크롤되고, 길게 눌러 집은 뒤 끈다(EventDragGrid).
                        className={`truncate rounded px-1 text-[10px] font-medium leading-[15px] ring-1 ring-inset ring-foreground/15 transition-transform ${editableEvents ? "cursor-grab select-none [-webkit-touch-callout:none] pointer-fine:touch-none data-[drag-armed]:relative data-[drag-armed]:z-10 data-[drag-armed]:scale-110 data-[drag-armed]:ring-2 data-[drag-armed]:ring-foreground" : ""}`}
                        style={{ backgroundColor: event.color, color: contrastTextColor(event.color) }}
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
                  {events.length > 0 && (
                    <span id={`calendar-events-${key}`} className="sr-only">
                      {eventLabel.slice(2)}
                    </span>
                  )}
                </DayLink>
              );
            })}
          </DayGrid>
        </SwapIn>
      </div>

      <p className="text-center text-xs text-muted sm:text-sm">이번 달 완료 {doneCount}개</p>
    </section>
  );
}

/**
 * 날짜 칸 링크. onSelect가 있으면 누를 때 서버에 가지 않고 그 함수만 부른다(주소는 그쪽이 바꾼다).
 * 없으면 한 달치 서른 칸을 보이는 대로 미리 받지 않고, 손가락·마우스가 닿는 순간 받는다(IntentLink).
 * 새 탭으로 여는 클릭(Ctrl·가운데 버튼)은 원래 링크대로 둔다.
 */
function DayLink({ onSelect, ...rest }: Omit<ComponentProps<typeof IntentLink>, "onSelect"> & { onSelect?: () => void }) {
  if (!onSelect) return <IntentLink draggable={false} {...rest} />;
  return (
    <Link
      prefetch={false}
      draggable={false}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onSelect();
      }}
      {...rest}
    />
  );
}

/** 날짜 칸 격자. 내 달력이면 일정 이름표를 끌 수 있게 감싼다. */
function DayGrid({ editable, children }: { editable: boolean; children: ReactNode }) {
  const className = "grid grid-cols-7 gap-0.5";
  if (!editable) return <TouchGuard className={className}>{children}</TouchGuard>;
  return <EventDragGrid className={className}>{children}</EventDragGrid>;
}
