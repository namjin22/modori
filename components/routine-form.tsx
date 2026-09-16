"use client";

import { useState } from "react";

import { createRoutine } from "@/app/(tabs)/settings/routines/actions";
import { SubmitButton } from "@/components/submit-button";

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

  return (
    <form action={createRoutine} className="flex flex-col gap-4">
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
        <option value="">카테고리 없음</option>
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

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          시작일
          <input
            type="date"
            name="startDate"
            defaultValue={today}
            className="h-11 rounded-xl bg-surface-hover px-3 text-sm text-foreground"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          종료일 (없으면 계속)
          <input
            type="date"
            name="endDate"
            className="h-11 rounded-xl bg-surface-hover px-3 text-sm text-foreground"
          />
        </label>
      </div>

      <SubmitButton
        pendingLabel="추가 중"
        className="h-12 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
      >
        루틴 추가
      </SubmitButton>
    </form>
  );
}
