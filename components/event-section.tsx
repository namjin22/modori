"use client";

import { useState } from "react";

import { EventForm } from "@/components/event-form";
import { Modal } from "@/components/modal";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";
import { formatKST, formatMonthDayKST, isSameKSTDate } from "@/lib/date";

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
 */
export function EventSection({
  events,
  date,
}: {
  events: DayEvent[];
  date: string;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DayEvent | null>(null);

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
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="새 일정"
      >
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
