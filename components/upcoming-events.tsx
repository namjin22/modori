"use client";

import { useState } from "react";

import { type DayEvent, Dday, EventEditModal } from "@/components/event-section";
import { useLocale, useT } from "@/components/locale-provider";
import { parseKSTDate } from "@/lib/date";
import { ddayLabel } from "@/lib/dday";
import { formatTime } from "@/lib/event-time";
import { formatMonthDay } from "@/lib/i18n/format";
import { events as eventMessages } from "@/lib/i18n/messages/events";

/**
 * 아직 오지 않은 일정(D-day). 보고 있는 날이 아니라 오늘을 기준으로 센다(2026-11-19: 일정 칸 아래에서 달력 칸으로 옮겼다).
 * 그 날짜를 열어보지 않아도 시험이 며칠 남았는지 알 수 있어야 한다. 줄을 누르면 일정을 고치는 창이 뜬다.
 * 보고 있는 날과 겹치는 일정은 홈이 이미 빼고 넘긴다(그 날의 일정 칸에 있다).
 */
export function UpcomingEvents({ events, date, today }: { events: DayEvent[]; date: string; today: string }) {
  const t = useT(eventMessages);
  const locale = useLocale();
  const [editing, setEditing] = useState<DayEvent | null>(null);
  const todayDate = parseKSTDate(today);

  if (events.length === 0) return null;

  return (
    <section aria-label={t("upcomingTitle")} className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{t("upcomingTitle")}</p>
      <ul className="flex flex-col gap-1">
        {events.map((event) => {
          const dday = ddayLabel(event.startDate, event.endDate, todayDate, locale);

          return (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => setEditing(event)}
                className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left text-sm text-muted hover:bg-surface"
              >
                <span aria-hidden className="color-edge size-2 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
                <span className="min-w-0 flex-1 truncate">{event.title}</span>
                <span className="shrink-0 text-xs">
                  {formatMonthDay(locale, event.startDate)}
                  {event.startTime !== null && ` ${formatTime(event.startTime)}`}
                </span>
                {dday && <Dday label={dday} locale={locale} />}
              </button>
            </li>
          );
        })}
      </ul>
      <EventEditModal event={editing} date={date} onClose={() => setEditing(null)} />
    </section>
  );
}
