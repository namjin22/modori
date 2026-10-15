"use client";

import { useState } from "react";

import {
  createRoutine,
  type RoutineFormState,
} from "@/app/(tabs)/routines/actions";
import { ChoicePicker } from "@/components/choice-picker";
import { ColorSwatches } from "@/components/color-swatches";
import { DatePicker } from "@/components/date-picker";
import { LabeledSwitch } from "@/components/labeled-switch";
import { SubmitButton } from "@/components/submit-button";
import { TimePicker } from "@/components/time-picker";
import { useFormAction } from "@/components/use-form-action";
import { DEFAULT_EVENT_COLOR } from "@/lib/colors";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

type Freq = "DAILY" | "WEEKLY" | "MONTHLY";

const FREQ_OPTIONS: { value: Freq; label: string }[] = [
  { value: "DAILY", label: "매일" },
  { value: "WEEKLY", label: "매주" },
  { value: "MONTHLY", label: "매월" },
];

export function RoutineForm({
  categories,
  today,
}: {
  categories: { id: string; name: string; color?: string }[];
  today: string;
}) {
  // 주기를 고르기 전에는 요일·날짜를 다 보여줄 이유가 없다. 폼이 화면을 넘어간다.
  const [freq, setFreq] = useState<Freq>("DAILY");
  // 할 일 루틴은 그날 할 일로 들어오고, 일정 루틴(반복 일정)은 달력과 일정 목록에 뜬다(2026-10-14 요청).
  const [kind, setKind] = useState<"TODO" | "EVENT">("TODO");

  // 서버가 거른 이유를 화면에 보여준다. 아무 일도 안 일어나면 고장 난 줄 안다.
  const [state, formAction, pending] = useFormAction<RoutineFormState>(
    createRoutine,
    null,
  );

  return (
    <form onSubmit={formAction} className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="루틴 종류" className="flex gap-1 rounded-xl bg-surface-hover p-1">
        {(
          [
            ["TODO", "할 일"],
            ["EVENT", "일정"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={`flex-1 rounded-lg py-2.5 text-sm transition-colors ${
              kind === value ? "bg-surface font-semibold text-foreground shadow-sm" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />

      {kind === "TODO" ? (
        <>
          <input
            name="content"
            required
            maxLength={200}
            placeholder="반복할 할 일"
            aria-label="루틴 내용"
            className="h-12 rounded-xl bg-surface-hover px-3 outline-none focus:ring-2 focus:ring-brand"
          />

          <ChoicePicker
            label="루틴 카테고리"
            name="categoryId"
            options={categories.map((category) => ({ value: category.id, label: category.name, color: category.color }))}
          />
        </>
      ) : (
        <EventRoutineFields />
      )}

      <div role="radiogroup" aria-label="반복 주기" className="flex gap-1 rounded-xl bg-surface-hover p-1">
        {FREQ_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={freq === option.value}
            onClick={() => setFreq(option.value)}
            className={`flex-1 rounded-lg py-2.5 text-sm transition-colors ${
              freq === option.value
                ? "bg-brand font-semibold text-brand-contrast"
                : "text-muted"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input type="hidden" name="freq" value={freq} />

      {freq === "WEEKLY" && (
        <fieldset className="flex justify-between gap-1">
          <legend className="sr-only">반복할 요일</legend>
          {WEEKDAY_NAMES.map((name, index) => (
            <label
              key={name}
              className="flex-1 cursor-pointer text-center text-sm"
            >
              <input
                type="checkbox"
                name="byWeekday"
                value={index}
                className="peer sr-only"
              />
              <span className="block rounded-lg bg-surface-hover py-2.5 text-muted transition-colors peer-checked:bg-brand peer-checked:font-semibold peer-checked:text-brand-contrast">
                {name}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {freq === "MONTHLY" && (
        <fieldset className="grid grid-cols-7 gap-1">
          <legend className="sr-only">반복할 날짜</legend>
          {MONTH_DAYS.map((day) => (
            <label key={day} className="cursor-pointer text-center text-sm">
              <input
                type="checkbox"
                name="byMonthday"
                value={day}
                className="peer sr-only"
              />
              <span className="block rounded-lg bg-surface-hover py-2 text-muted transition-colors peer-checked:bg-brand peer-checked:font-semibold peer-checked:text-brand-contrast">
                {day}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {/* 날짜는 누르면 달력이 뜬다(components/date-picker.tsx). 한글 날짜가 길어 좁은 폰에서는 한 줄에 하나씩 둔다. */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1 text-xs text-muted">
          시작일
          <DatePicker label="루틴 시작일" name="startDate" defaultValue={today} />
        </div>

        <div className="flex min-w-0 flex-col gap-1 text-xs text-muted">
          종료일 (없으면 계속)
          <DatePicker label="루틴 종료일" name="endDate" clearable emptyText="계속 (종료일 없음)" />
        </div>
      </div>

      {state && (
        <p
          role="status"
          className={`text-sm ${
            state.ok
              ? "text-brand"
              : "text-danger"
          }`}
        >
          {state.message}
        </p>
      )}

      <SubmitButton
        pending={pending}
        pendingLabel="추가 중"
        className="h-12 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
      >
        루틴 추가
      </SubmitButton>
    </form>
  );
}

/** 일정 루틴의 이름·시간·색. 일정 만들기(components/event-form.tsx)와 같은 칸이고, 날짜 대신 위의 반복 규칙을 쓴다. */
export function EventRoutineFields({
  initial,
}: {
  initial?: { title: string; color: string; startTime: string; endTime: string };
}) {
  const [allDay, setAllDay] = useState(!initial?.startTime);
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");

  return (
    <>
      <input
        name="title"
        required
        maxLength={100}
        defaultValue={initial?.title}
        placeholder="예: 학원, 동아리, 운동"
        aria-label="반복 일정 이름"
        className="h-12 rounded-xl bg-surface-hover px-3 outline-none focus:ring-2 focus:ring-brand"
      />
      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <LabeledSwitch
          name="allDay"
          title="하루 종일"
          checked={allDay}
          onChange={(checked) => {
            setAllDay(checked);
            if (!checked && !startTime) {
              setStartTime("18:00");
              setEndTime("19:00");
            }
          }}
        />
        {!allDay && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-xs text-muted">시작</span>
              <TimePicker label="반복 일정 시작" value={startTime} onChange={setStartTime} />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-xs text-muted">끝</span>
              <TimePicker label="반복 일정 종료" value={endTime} onChange={setEndTime} optional />
            </div>
          </div>
        )}
        <input type="hidden" name="startTime" value={allDay ? "" : startTime} />
        <input type="hidden" name="endTime" value={allDay ? "" : endTime} />
      </div>
      <ColorSwatches name="color" legend="색" defaultValue={initial?.color ?? DEFAULT_EVENT_COLOR} />
    </>
  );
}
