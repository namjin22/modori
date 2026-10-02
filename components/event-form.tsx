"use client";

import { useEffect, useState } from "react";

import {
  createEvent,
  type EventFormState,
  updateEvent,
} from "@/app/(tabs)/events/actions";
import { DatePicker } from "@/components/date-picker";
import { LabeledSwitch } from "@/components/labeled-switch";
import { SubmitButton } from "@/components/submit-button";
import { TimePicker } from "@/components/time-picker";
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
 * 이름·날짜 칸의 Enter나 "저장"으로 저장한다(2026-09-29 사용자 요청으로 Enter 저장을 되살렸다). 메모 칸의 Enter는 줄바꿈이다.
 * "하루 종일"을 끄면 시작·끝 시간을 드롭다운으로 고른다(components/time-picker.tsx).
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
  const [allDay, setAllDay] = useState(!event?.startTime);
  const [startDate, setStartDate] = useState(event?.startDate ?? defaultDate);
  const [endDate, setEndDate] = useState(event?.endDate ?? defaultDate);
  const [startTime, setStartTime] = useState(event?.startTime ?? "");
  const [endTime, setEndTime] = useState(event?.endTime ?? "");

  // 시작을 끝보다 늦게 옮기면 끝을 한 시간 뒤로 따라 옮긴다. 그대로 두면 저장할 때 "끝이 시작보다 이르다"에 걸린다.
  // "HH:MM"은 글자 순서가 시간 순서와 같아 그대로 견준다.
  // 시작일을 종료일보다 뒤로 옮기면 종료일도 같이 옮긴다. 그대로 두면 저장할 때 "종료일이 시작일보다 앞설 수 없어요"에 걸린다.
  // "YYYY-MM-DD"도 글자 순서가 날짜 순서와 같다.
  function changeStartDate(next: string) {
    setStartDate(next);
    if (next && endDate && endDate < next) setEndDate(next);
  }

  function changeStart(next: string) {
    setStartTime(next);
    if (next && endTime && endTime <= next) setEndTime(oneHourLater(next));
  }

  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <form
      onSubmit={action}
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
        placeholder="예: 시험, 친구 생일, 병원 예약"
        aria-label={`${label} 이름`}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key === "Escape") onCancel();
        }}
        className="h-12 w-full rounded-xl bg-surface-hover px-4 text-[15px] outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
      />

      {/* 날짜는 누르면 달력이 뜬다(components/date-picker.tsx). 한글 날짜가 길어 한 줄에 하나씩 둔다. */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5 text-xs text-muted">
          시작일
          <DatePicker label={`${label} 시작일`} name="startDate" value={startDate} onChange={changeStartDate} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 text-xs text-muted">
          종료일
          <DatePicker label={`${label} 종료일`} name="endDate" value={endDate} onChange={setEndDate} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <LabeledSwitch
          name="allDay"
          title="하루 종일"
          checked={allDay}
          onChange={(checked) => {
            setAllDay(checked);
            // 처음 시간을 켤 때 흔한 값(오전 9시~10시)을 넣어 둔다. 빈 칸에서 고르는 것보다 빠르다.
            if (!checked && !startTime) {
              setStartTime("09:00");
              setEndTime("10:00");
            }
          }}
        />
        {!allDay && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-xs text-muted">시작</span>
              <TimePicker label={`${label} 시작`} value={startTime} onChange={changeStart} />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-xs text-muted">끝</span>
              <TimePicker label={`${label} 종료`} value={endTime} onChange={setEndTime} optional />
            </div>
          </div>
        )}
        <input type="hidden" name="startTime" value={allDay ? "" : startTime} />
        <input type="hidden" name="endTime" value={allDay ? "" : endTime} />
      </div>

      <LabeledSwitch
        name="dday"
        title="D-day 보이기"
        description="끄면 D-day와 다가오는 일정 목록에서 빠져요"
        defaultChecked={event?.dday ?? true}
      />

      {/* 메모 칸의 Enter는 줄바꿈이다(textarea라 폼을 보내지 않는다). */}
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

/** 한 시간 뒤. 자정을 넘기면 그날 23:55에서 멈춘다(끝 시간은 같은 날 안에서 고른다). */
function oneHourLater(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const minutes = Math.min(hour * 60 + minute + 60, 23 * 60 + 55);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
