"use client";

import { useActionState, useEffect } from "react";

import {
  createEvent,
  type EventFormState,
  updateEvent,
} from "@/app/(tabs)/events/actions";

type EditingEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
};

/**
 * 일정 만들기와 고치기에 같이 쓴다. 떠 있는 창 안에 들어간다.
 *
 * 저장 버튼을 두지 않는다. 이름을 적고 Enter를 누르면 저장된다.
 * 날짜는 바꾸는 일이 드물어서 이름 아래에 조용히 둔다.
 */
export function EventForm({
  event,
  defaultDate,
  onSaved,
}: {
  event?: EditingEvent;
  defaultDate: string;
  onSaved: () => void;
}) {
  const [state, action] = useActionState<EventFormState, FormData>(
    event ? updateEvent : createEvent,
    null,
  );
  // 만들기 창과 고치기 창이 한 화면에 여럿 떠 있을 수 있다. 이름표를 구분한다.
  const label = event ? "일정" : "새 일정";

  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {event && <input type="hidden" name="id" value={event.id} />}

      <input
        name="title"
        required
        maxLength={100}
        defaultValue={event?.title}
        autoFocus
        placeholder="예: 중간고사, 동아리 발표"
        aria-label={`${label} 이름`}
        className="h-12 w-full rounded-xl bg-surface-hover px-4 text-[15px] outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          시작일
          <input
            type="date"
            name="startDate"
            required
            defaultValue={event?.startDate ?? defaultDate}
            aria-label={`${label} 시작일`}
            className="h-11 rounded-xl bg-surface-hover px-3 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          종료일
          <input
            type="date"
            name="endDate"
            defaultValue={event?.endDate ?? defaultDate}
            aria-label={`${label} 종료일`}
            className="h-11 rounded-xl bg-surface-hover px-3 text-sm text-foreground"
          />
        </label>
      </div>

      {state?.message && !state.ok && (
        <p role="alert" className="text-sm text-red-500">
          {state.message}
        </p>
      )}

      {/* 화면에는 두지 않는다. 날짜 칸에서 Enter를 눌러도 저장되게 하는 버튼이다. */}
      <button type="submit" className="sr-only">
        {event ? "일정 고치기" : "일정 넣기"}
      </button>
    </form>
  );
}
