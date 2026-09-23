"use client";

import { useState } from "react";

import { EventForm } from "@/components/event-form";
import { Modal } from "@/components/modal";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";
import { formatKST, formatMonthDayKST, isSameKSTDate, parseKSTDate } from "@/lib/date";
import { ddayLabel } from "@/lib/dday";

import { deleteEvent, restoreEvent } from "@/app/(tabs)/events/actions";

export type DayEvent = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  color: string;
};

/**
 * 고른 날의 일정. 할 일과 달리 체크가 없고, 달력에 이름으로 보인다.
 * "일정"을 누르면 만들고, 일정 이름을 누르면 고친다. 둘 다 떠 있는 창에서 한다.
 *
 * 아직 오지 않은 일정도 몇 개 같이 보여준다. 그 날짜를 열어보지 않아도
 * 시험이 며칠 남았는지 알 수 있어야 한다.
 */
export function EventSection({
  events,
  upcoming,
  date,
  today,
}: {
  events: DayEvent[];
  upcoming: DayEvent[];
  date: string;
  today: string;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DayEvent | null>(null);
  const todayDate = parseKSTDate(today);

  return (
    <section aria-label="일정" className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-foreground"
      >
        일정
        <span aria-hidden className="text-muted">
          +
        </span>
      </button>

      {events.length > 0 && (
        <ul className="flex flex-col gap-2">
          {events.map((event) => {
            const multiDay = !isSameKSTDate(event.startDate, event.endDate);
            const dday = ddayLabel(event.startDate, event.endDate, todayDate);

            return (
              <li
                key={event.id}
                className="overflow-hidden rounded-xl bg-surface"
                style={{ boxShadow: `inset 4px 0 0 ${event.color}` }}
              >
                <button
                  type="button"
                  onClick={() => setEditing(event)}
                  className="flex w-full cursor-pointer items-center gap-3 py-3 pl-4 pr-4 text-left"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {event.title}
                  </span>
                  {multiDay && (
                    <span className="shrink-0 text-xs text-muted">
                      {formatMonthDayKST(event.startDate)} ~{" "}
                      {formatMonthDayKST(event.endDate)}
                    </span>
                  )}
                  {dday && <Dday label={dday} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {upcoming.length > 0 && (
        <ul className="flex flex-col gap-1">
          {upcoming.map((event) => {
            const dday = ddayLabel(event.startDate, event.endDate, todayDate);

            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => setEditing(event)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left text-sm text-muted hover:bg-surface"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: event.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{event.title}</span>
                  <span className="shrink-0 text-xs">
                    {formatMonthDayKST(event.startDate)}
                  </span>
                  {dday && <Dday label={dday} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="새 일정">
        <EventForm defaultDate={date} onSaved={() => setCreating(false)} />
        <p className="text-xs text-muted">Enter로 저장돼요.</p>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="일정"
      >
        {editing && (
          <>
            <EventForm
              defaultDate={date}
              event={{
                id: editing.id,
                title: editing.title,
                startDate: formatKST(editing.startDate),
                endDate: formatKST(editing.endDate),
              }}
              onSaved={() => setEditing(null)}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">Enter로 저장돼요.</p>
              <UndoableDeleteButton
                id={editing.id}
                remove={deleteEvent}
                restore={restoreEvent}
                message="일정을 지웠어요"
                onDone={() => setEditing(null)}
                className="h-10 rounded-xl px-3 text-sm font-medium text-red-500"
              />
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}

/** 오늘과 그 앞뒤는 눈에 띄어야 하고, 먼 일정은 조용해야 한다. */
function Dday({ label }: { label: string }) {
  const soon = label === "D-DAY" || label === "진행 중";

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        soon ? "bg-brand text-brand-contrast" : "bg-surface-hover text-muted"
      }`}
    >
      {label}
    </span>
  );
}
