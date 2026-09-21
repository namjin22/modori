import { EventForm } from "@/components/event-form";
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
 * 만들기와 고치기 모두 펼침(details)으로 열어서 클라이언트 상태를 두지 않는다.
 */
export function EventSection({
  events,
  date,
}: {
  events: DayEvent[];
  date: string;
}) {
  return (
    <section aria-label="일정" className="flex flex-col gap-3">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
          <h2 className="text-sm font-semibold">일정</h2>
          <span className="flex h-8 items-center rounded-full bg-surface px-3 text-sm text-muted group-open:bg-foreground group-open:text-background">
            <span className="group-open:hidden">+ 일정 만들기</span>
            <span className="hidden group-open:inline">닫기</span>
          </span>
        </summary>
        <div className="mt-2 rounded-2xl bg-surface p-4">
          <EventForm defaultDate={date} />
        </div>
      </details>

      {events.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {events.map((event) => {
            const multiDay = !isSameKSTDate(event.startDate, event.endDate);

            return (
              <li
                key={event.id}
                className="overflow-hidden rounded-xl bg-surface"
                style={{ boxShadow: `inset 4px 0 0 ${event.color}` }}
              >
                <details className="group/event">
                  <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 pl-4 pr-3 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {event.title}
                    </span>
                    {multiDay && (
                      <span className="shrink-0 text-xs text-muted">
                        {formatMonthDayKST(event.startDate)} ~{" "}
                        {formatMonthDayKST(event.endDate)}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-muted group-open/event:text-brand">
                      수정
                    </span>
                  </summary>
                  <div className="flex flex-col gap-3 px-4 pb-3">
                    <EventForm
                      defaultDate={date}
                      event={{
                        id: event.id,
                        title: event.title,
                        startDate: formatKST(event.startDate),
                        endDate: formatKST(event.endDate),
                      }}
                    />
                    <div className="flex justify-end">
                      <UndoableDeleteButton
                        id={event.id}
                        remove={deleteEvent}
                        restore={restoreEvent}
                        message="일정을 지웠어요"
                        className="h-9 rounded-xl px-3 text-sm text-red-500"
                      />
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
