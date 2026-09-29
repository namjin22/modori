"use client";

import { useEffect } from "react";

import {
  createEvent,
  type EventFormState,
  updateEvent,
} from "@/app/(tabs)/events/actions";
import { LabeledSwitch } from "@/components/labeled-switch";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/components/use-form-action";
import { MAX_MEMO_LENGTH } from "@/lib/memo";

type EditingEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  // "HH:MM", 없으면 빈 문자열(하루 종일).
  startTime: string;
  endTime: string;
  memo: string;
  dday: boolean;
};

/**
 * 일정 만들기와 고치기에 같이 쓴다. 떠 있는 창 안에 들어간다.
 *
 * 아래의 "저장"으로만 저장한다(사용자 요청). 날짜·시간 칸을 옮겨 다니다 Enter를 눌러 덜 고친 채
 * 저장되는 일이 없게, 입력칸의 Enter는 막는다. 시간은 비워 두면 하루 종일이다.
 */
export function EventForm({
  event,
  defaultDate,
  onSaved,
  onCancel,
}: {
  event?: EditingEvent;
  defaultDate: string;
  onSaved: () => void;
  // 취소를 누르면 만들기 칸이나 고치는 창을 닫는다.
  onCancel: () => void;
}) {
  const [state, action, pending] = useFormAction<EventFormState>(
    event ? updateEvent : createEvent,
    null,
  );
  // 만들기 창과 고치기 창이 한 화면에 여럿 떠 있을 수 있다. 이름표를 구분한다.
  const label = event ? "일정" : "새 일정";

  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <form
      onSubmit={action}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === "Enter" && keyEvent.target instanceof HTMLInputElement) keyEvent.preventDefault();
      }}
      className="flex flex-col gap-4"
    >
      {event && <input type="hidden" name="id" value={event.id} />}

      <input
        name="title"
        required
        maxLength={100}
        defaultValue={event?.title}
        autoFocus
        data-autofocus
        placeholder="예: 중간고사, 동아리 발표"
        aria-label={`${label} 이름`}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key === "Escape") onCancel();
        }}
        className="h-12 w-full rounded-xl bg-surface-hover px-4 text-[15px] outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
      />

      {/* 360px보다 좁은 폰에서는 날짜 칸이 "2026-09-"까지만 보여서 한 줄에 하나씩 둔다. */}
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted">
          시작일
          <input
            type="date"
            name="startDate"
            required
            defaultValue={event?.startDate ?? defaultDate}
            aria-label={`${label} 시작일`}
            className="h-11 w-full min-w-0 rounded-xl bg-surface-hover px-3 text-sm text-foreground"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted">
          종료일
          <input
            type="date"
            name="endDate"
            defaultValue={event?.endDate ?? defaultDate}
            aria-label={`${label} 종료일`}
            className="h-11 w-full min-w-0 rounded-xl bg-surface-hover px-3 text-sm text-foreground"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted">
          시작 시간
          <input
            type="time"
            name="startTime"
            defaultValue={event?.startTime ?? ""}
            aria-label={`${label} 시작 시간`}
            className="h-11 w-full min-w-0 rounded-xl bg-surface-hover px-3 text-sm text-foreground"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted">
          종료 시간
          <input
            type="time"
            name="endTime"
            defaultValue={event?.endTime ?? ""}
            aria-label={`${label} 종료 시간`}
            className="h-11 w-full min-w-0 rounded-xl bg-surface-hover px-3 text-sm text-foreground"
          />
        </label>
      </div>

      <LabeledSwitch
        name="dday"
        title="D-day 보이기"
        description="끄면 D-day와 다가오는 일정 목록에서 빠져요"
        defaultChecked={event?.dday ?? true}
      />

      {/* 메모 칸의 Enter는 줄바꿈이다(위의 Enter 막기는 input에만 건다). */}
      <textarea
        name="memo"
        defaultValue={event?.memo ?? ""}
        maxLength={MAX_MEMO_LENGTH}
        rows={3}
        placeholder="메모 (나만 봐요)"
        aria-label={`${label} 메모`}
        className="w-full resize-none rounded-xl bg-surface-hover px-4 py-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
      />

      {state?.message && !state.ok && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}

      <p className="-mt-1 text-xs text-muted">시간은 비워 두면 하루 종일이에요.</p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-xl bg-surface-hover text-sm font-semibold"
        >
          취소
        </button>
        <SubmitButton
          pending={pending}
          pendingLabel="저장 중"
          className="h-11 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
        >
          저장
        </SubmitButton>
      </div>
    </form>
  );
}
