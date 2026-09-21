"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  createEvent,
  type EventFormState,
  updateEvent,
} from "@/app/(tabs)/events/actions";
import { ColorSwatches } from "@/components/color-swatches";
import { SubmitButton } from "@/components/submit-button";
import { DEFAULT_EVENT_COLOR } from "@/lib/colors";

type EditingEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  color: string;
};

/**
 * 일정 만들기와 고치기에 같이 쓴다. 저장되면 감싸고 있는 펼침(details)을 닫는다.
 * 만들 때는 입력칸도 비워서 다음 일정을 바로 적을 수 있게 한다.
 */
export function EventForm({
  event,
  defaultDate,
}: {
  event?: EditingEvent;
  defaultDate: string;
}) {
  const [state, action] = useActionState<EventFormState, FormData>(
    event ? updateEvent : createEvent,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  // 만들기 폼과 이미 있는 일정의 수정 폼이 한 화면에 같이 있다. 이름표를 구분한다.
  const label = event ? "일정" : "새 일정";

  useEffect(() => {
    if (!state?.ok) return;
    const form = formRef.current;
    if (!event) form?.reset();
    form?.closest("details")?.removeAttribute("open");
  }, [state, event]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      {event && <input type="hidden" name="id" value={event.id} />}
      <input
        name="title"
        required
        maxLength={100}
        defaultValue={event?.title}
        placeholder="예: 중간고사, 동아리 발표"
        aria-label={`${label} 이름`}
        className="h-10 rounded-xl bg-surface-hover px-3 text-[15px] outline-none focus:ring-2 focus:ring-brand"
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          시작일
          <input
            type="date"
            name="startDate"
            required
            defaultValue={event?.startDate ?? defaultDate}
            aria-label={`${label} 시작일`}
            className="h-10 rounded-xl bg-surface-hover px-3 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          종료일
          <input
            type="date"
            name="endDate"
            defaultValue={event?.endDate ?? defaultDate}
            aria-label={`${label} 종료일`}
            className="h-10 rounded-xl bg-surface-hover px-3 text-sm text-foreground"
          />
        </label>
      </div>
      <ColorSwatches
        name="color"
        legend="색"
        defaultValue={event?.color ?? DEFAULT_EVENT_COLOR}
      />

      {state?.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`text-sm ${state.ok ? "text-brand" : "text-red-500"}`}
        >
          {state.message}
        </p>
      )}

      <SubmitButton
        pendingLabel="저장 중"
        className="h-10 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
      >
        {event ? "일정 고치기" : "일정 넣기"}
      </SubmitButton>
    </form>
  );
}
