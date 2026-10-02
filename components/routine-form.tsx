"use client";

import { useState } from "react";

import {
  createRoutine,
  type RoutineFormState,
} from "@/app/(tabs)/routines/actions";
import { DatePicker } from "@/components/date-picker";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/components/use-form-action";

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
  categories: { id: string; name: string }[];
  today: string;
}) {
  // 주기를 고르기 전에는 요일·날짜를 다 보여줄 이유가 없다. 폼이 화면을 넘어간다.
  const [freq, setFreq] = useState<Freq>("DAILY");

  // 서버가 거른 이유를 화면에 보여준다. 아무 일도 안 일어나면 고장 난 줄 안다.
  const [state, formAction, pending] = useFormAction<RoutineFormState>(
    createRoutine,
    null,
  );

  return (
    <form onSubmit={formAction} className="flex flex-col gap-5">
      <input
        name="content"
        required
        maxLength={200}
        placeholder="반복할 할 일"
        aria-label="루틴 내용"
        className="h-12 rounded-xl bg-surface-hover px-3 outline-none focus:ring-2 focus:ring-brand"
      />

      <select
        name="categoryId"
        aria-label="루틴 카테고리"
        className="h-12 rounded-xl bg-surface-hover px-3 text-sm"
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

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
