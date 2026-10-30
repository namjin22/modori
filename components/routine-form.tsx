"use client";

import { useState } from "react";

import {
  createRoutine,
  type RoutineFormState,
} from "@/app/(tabs)/routines/actions";
import { ChoicePicker } from "@/components/choice-picker";
import { ColorSwatches } from "@/components/color-swatches";
import { DatePicker } from "@/components/date-picker";
import { useLocale, useT } from "@/components/locale-provider";
import { LabeledSwitch } from "@/components/labeled-switch";
import { PrivateSwitch } from "@/components/private-switch";
import { SubmitButton } from "@/components/submit-button";
import { TimePicker } from "@/components/time-picker";
import { useFormAction } from "@/components/use-form-action";
import { DEFAULT_EVENT_COLOR } from "@/lib/colors";
import { weekdayNames } from "@/lib/i18n/format";
import { events } from "@/lib/i18n/messages/events";
import { routines } from "@/lib/i18n/messages/routines";

const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

type Freq = "DAILY" | "WEEKLY" | "MONTHLY";

const FREQ_OPTIONS = [
  { value: "DAILY", label: "daily" },
  { value: "WEEKLY", label: "weekly" },
  { value: "MONTHLY", label: "monthly" },
] as const;

export function RoutineForm({
  categories,
  today,
}: {
  categories: { id: string; name: string; color?: string }[];
  today: string;
}) {
  const t = useT(routines);
  const locale = useLocale();
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
      <div role="radiogroup" aria-label={t("kindLabel")} className="flex gap-1 rounded-xl bg-surface-hover p-1">
        {(
          [
            ["TODO", t("kindTodo")],
            ["EVENT", t("kindEvent")],
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
            placeholder={t("contentPlaceholder")}
            aria-label={t("contentLabel")}
            className="h-12 rounded-xl bg-surface-hover px-3 outline-none focus:ring-2 focus:ring-brand"
          />

          <ChoicePicker
            label={t("categoryLabel")}
            name="categoryId"
            options={categories.map((category) => ({ value: category.id, label: category.name, color: category.color }))}
          />
        </>
      ) : (
        <EventRoutineFields />
      )}

      <div role="radiogroup" aria-label={t("freqLabel")} className="flex gap-1 rounded-xl bg-surface-hover p-1">
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
            {t(option.label)}
          </button>
        ))}
      </div>
      <input type="hidden" name="freq" value={freq} />

      {freq === "WEEKLY" && (
        <fieldset className="flex justify-between gap-1">
          <legend className="sr-only">{t("weekdayLegend")}</legend>
          {weekdayNames(locale).map((name, index) => (
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
          <legend className="sr-only">{t("monthdayLegend")}</legend>
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
      {/* 짧은 날짜라 폰에서도 한 줄에 둘이 들어간다(일정 창과 같다, 2026-10-20). */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1 text-xs text-muted">
          {t("startDate")}
          <DatePicker label={t("startLabel")} name="startDate" defaultValue={today} short />
        </div>

        <div className="flex min-w-0 flex-col gap-1 text-xs text-muted">
          {t("endDate")}
          <DatePicker label={t("endLabel")} name="endDate" clearable emptyText={t("noEnd")} shortEmptyText={t("noEndShort")} short />
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
        pendingLabel={t("adding")}
        className="h-12 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
      >
        {t("add")}
      </SubmitButton>
    </form>
  );
}

/** 일정 루틴의 이름·시간·색. 일정 만들기(components/event-form.tsx)와 같은 칸이고, 날짜 대신 위의 반복 규칙을 쓴다. */
export function EventRoutineFields({
  initial,
}: {
  initial?: { title: string; color: string; startTime: string; endTime: string; isPublic?: boolean };
}) {
  const t = useT(routines);
  const te = useT(events);
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
        placeholder={t("eventNamePlaceholder")}
        aria-label={t("eventNameLabel")}
        className="h-12 rounded-xl bg-surface-hover px-3 outline-none focus:ring-2 focus:ring-brand"
      />
      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <LabeledSwitch
          name="allDay"
          title={te("allDay")}
          checked={allDay}
          onChange={(checked) => {
            setAllDay(checked);
            if (!checked && !startTime) {
              setStartTime("18:00");
              setEndTime("19:00");
            }
          }}
        />
        {/* 일정 창과 같이 시작·끝을 한 줄에 둔다(2026-10-20). */}
        {!allDay && (
          <div className="flex animate-rise items-center gap-2">
            <TimePicker label={t("repeatStart")} value={startTime} onChange={setStartTime} />
            <span aria-hidden className="shrink-0 text-sm text-muted">~</span>
            <TimePicker label={t("repeatEnd")} value={endTime} onChange={setEndTime} optional />
          </div>
        )}
        <input type="hidden" name="startTime" value={allDay ? "" : startTime} />
        <input type="hidden" name="endTime" value={allDay ? "" : endTime} />
      </div>
      <ColorSwatches name="color" legend={te("color")} defaultValue={initial?.color ?? DEFAULT_EVENT_COLOR} />
      {/* 팔로우한 친구에게 숨길지(일정과 같다, 기본은 보인다, 2026-10-18). */}
      <PrivateSwitch title={te("privateTitle")} description={t("privateHint")} defaultChecked={initial ? initial.isPublic === false : false} />
    </>
  );
}
