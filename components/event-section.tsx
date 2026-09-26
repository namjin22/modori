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
 *
 * 만들 때는 "일정" 아래에 입력칸이 바로 열린다. 고칠 때는 날짜까지 손봐야 해서
 * 목록 한가운데가 밀리지 않도록 떠 있는 창에서 한다.
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
  const empty = events.length === 0 && upcoming.length === 0;

  return (
    <section aria-label="일정" className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={creating}
        onClick={() => setCreating((value) => !value)}
        className="-mx-1.5 -my-1.5 w-fit px-1.5 py-1.5 text-sm font-semibold text-foreground"
      >
        일정
      </button>

      {creating && (
        <div className="rounded-2xl bg-surface p-4">
          <EventForm
            defaultDate={date}
            onSaved={() => setCreating(false)}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

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
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left"
                >
                  {/* 기간을 제목 옆에 두면 좁은 폰(320px)에서 제목이 세 글자만 남는다. 아래 줄로 내린다. */}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{event.title}</span>
                    {multiDay && (
                      <span className="text-xs text-muted">
                        {formatMonthDayKST(event.startDate)} ~{" "}
                        {formatMonthDayKST(event.endDate)}
                      </span>
                    )}
                  </span>
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
                    className="color-edge size-2 shrink-0 rounded-full"
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

      {/* 제목만 있으면 누를 수 있는 곳인지 모른다. 비어 있을 때만 자리를 만들어 준다. */}
      {empty && !creating && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-xl border border-dashed border-border py-3 text-sm text-muted hover:bg-surface"
        >
          시험이나 행사 적어두기
        </button>
      )}

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
            <div className="flex justify-end">
              <UndoableDeleteButton
                id={editing.id}
                remove={deleteEvent}
                restore={restoreEvent}
                message="일정을 지웠어요"
                onDone={() => setEditing(null)}
                className="h-10 rounded-xl px-3 text-sm font-medium text-danger"
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
