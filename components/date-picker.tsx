"use client";

import { useState } from "react";

import { useLocale, useT } from "@/components/locale-provider";
import { useTimezone } from "@/components/timezone-context";
import { Modal } from "@/components/modal";
import {
  addDays,
  addMonths,
  formatKST,
  parseKSTDate,
  startOfMonthKST,
  todayIn,
  weekdayKST,
} from "@/lib/date";
import type { Locale } from "@/lib/i18n";
import { fullDate, fullDateWithWeekday, monthDayWithWeekday, monthName, weekdayName, weekdayNames, yearMonth, yearOnly } from "@/lib/i18n/format";
import { datetime } from "@/lib/i18n/messages/datetime";

/** "2026-10-02" → "2026년 10월 2일 (금)". 읽을 수 없으면 null. */
function longLabel(locale: Locale, value: string): string | null {
  if (!value) return null;
  try {
    const date = parseKSTDate(value);
    return fullDateWithWeekday(locale, date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), weekdayKST(date));
  } catch (error) {
    console.warn("[date-picker] 날짜를 읽지 못했다.", value, error instanceof Error ? error.name : error);
    return null;
  }
}

/**
 * 좁은 칸에 쓰는 짧은 날짜. 올해는 "10월 2일 (금)", 다른 해는 "2027.1.5 (화)".
 * 일정 창은 날짜 두 칸이 한 줄에 놓여 긴 날짜가 스크롤바만 생겨도 잘렸다(2026-10-20). 단추 이름(화면 읽기·시험용)은 긴 날짜 그대로다.
 */
function shortLabel(locale: Locale, value: string, thisYear: number): string | null {
  if (!value) return null;
  try {
    const date = parseKSTDate(value);
    const [year, month, day] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
    const weekday = weekdayKST(date);
    return year === thisYear ? monthDayWithWeekday(locale, month, day, weekday) : `${year}.${month}.${day} (${weekdayName(locale, weekday)})`;
  } catch (error) {
    console.warn("[date-picker] 날짜를 읽지 못했다.", value, error instanceof Error ? error.name : error);
    return null;
  }
}

/**
 * 날짜 고르는 창. 브라우저 기본 날짜 칸(<input type="date">)은 기기마다 모양이 달랐고, 폰에서는 칸이 잘리거나 한 달씩
 * 넘기기가 불편했다(사용자 제보). 누르면 달력이 뜨고, 날을 누르면 바로 정해진다. 값은 "YYYY-MM-DD"로 주고받아 서버는 그대로다.
 *
 * name을 주면 폼에 그 이름으로 값이 실려 간다(숨은 칸). value·onChange를 주면 부모가 값을 쥔다.
 */
export function DatePicker({
  label,
  name,
  value,
  defaultValue = "",
  onChange,
  clearable = false,
  emptyText,
  compact = false,
  short = false,
  shortEmptyText,
}: {
  // 화면 읽기용 이름. 단추 이름은 "새 일정 시작일: 2026년 10월 2일 (금)"처럼 읽힌다.
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  // 날짜를 비울 수 있으면(루틴의 종료일) "날짜 없음" 칸을 둔다.
  clearable?: boolean;
  emptyText?: string;
  compact?: boolean;
  // 좁은 칸용: 단추에 짧은 날짜를 보인다.
  short?: boolean;
  // 좁은 칸에서 비어 있을 때 보일 짧은 글. 단추 이름(화면 읽기)은 emptyText 그대로다.
  shortEmptyText?: string;
}) {
  const timezone = useTimezone();
  const locale = useLocale();
  const t = useT(datetime);
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const [open, setOpen] = useState(false);

  function choose(next: string) {
    setInner(next);
    onChange?.(next);
    setOpen(false);
  }

  const text = longLabel(locale, current) ?? emptyText ?? t("pickDate");
  const shown = short
    ? (shortLabel(locale, current, todayIn(timezone).getUTCFullYear()) ?? (current ? text : (shortEmptyText ?? text)))
    : text;

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${label}: ${text}`}
        aria-haspopup="dialog"
        className={`flex ${compact ? "h-10" : "h-11"} w-full min-w-0 items-center gap-2 rounded-xl bg-surface-hover px-3 text-left text-sm text-foreground transition-colors hover:bg-border/60`}
      >
        <span aria-hidden className="shrink-0 text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="5" width="17" height="15.5" rx="4" />
            <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
          </svg>
        </span>
        <span className={`min-w-0 truncate ${current ? "" : "text-muted"}`}>{shown}</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t("pickDate")}>
        <PickerBody current={current} clearable={clearable} onChoose={choose} />
      </Modal>
    </>
  );
}

type Mode = "days" | "months";

function PickerBody({
  current,
  clearable,
  onChoose,
}: {
  current: string;
  clearable: boolean;
  onChoose: (value: string) => void;
}) {
  const locale = useLocale();
  const t = useT(datetime);
  const today = todayIn(useTimezone());
  const selected = longLabel(locale, current) ? current : "";
  // 처음에는 고른 날이 있는 달, 없으면 이번 달을 보여준다.
  const [view, setView] = useState(() => startOfMonthKST(selected ? parseKSTDate(selected) : today));
  const [mode, setMode] = useState<Mode>("days");
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);

  const todayKey = formatKST(today);
  const firstCell = addDays(view, -weekdayKST(view));
  const cells = Array.from({ length: 42 }, (_, index) => addDays(firstCell, index));
  const viewMonth = view.getUTCMonth();

  function applyTyped() {
    const text = typed.trim();
    try {
      onChoose(formatKST(parseKSTDate(text)));
    } catch (error) {
      console.warn("[date-picker] 직접 적은 날짜가 틀렸다.", text, error instanceof Error ? error.name : error);
      setTypedError(t("typedHint"));
    }
  }

  const nav = "flex size-9 items-center justify-center rounded-full bg-surface-hover text-base text-foreground";
  const chip = "h-9 rounded-full bg-surface-hover px-3.5 text-sm font-medium text-foreground";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setView(addMonths(view, mode === "days" ? -1 : -12))}
          aria-label={mode === "days" ? t("prevMonth") : t("prevYear")}
          className={nav}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "days" ? "months" : "days")}
          aria-label={
            mode === "days"
              ? t("chooseYearMonth", { label: yearMonth(locale, view.getUTCFullYear(), viewMonth + 1) })
              : t("backToDays", { label: yearOnly(locale, view.getUTCFullYear()) })
          }
          className="rounded-full px-3 py-1.5 text-base font-bold hover:bg-surface-hover"
        >
          {mode === "days" ? yearMonth(locale, view.getUTCFullYear(), viewMonth + 1) : yearOnly(locale, view.getUTCFullYear())}
          <span aria-hidden className="ml-1 text-xs text-muted">
            ▾
          </span>
        </button>
        <button
          type="button"
          onClick={() => setView(addMonths(view, mode === "days" ? 1 : 12))}
          aria-label={mode === "days" ? t("nextMonth") : t("nextYear")}
          className={nav}
        >
          ›
        </button>
      </div>

      {mode === "months" ? (
        <div role="group" aria-label={t("chooseMonth")} className="grid grid-cols-4 gap-2">
          {Array.from({ length: 12 }, (_, month) => {
            const isCurrent = month === viewMonth;
            return (
              <button
                key={month}
                type="button"
                aria-pressed={isCurrent}
                onClick={() => {
                  setView(addMonths(view, month - viewMonth));
                  setMode("days");
                }}
                className={`h-11 rounded-xl text-sm font-medium ${
                  isCurrent ? "bg-brand text-brand-contrast" : "bg-surface-hover text-foreground"
                }`}
              >
                {monthName(locale, month + 1)}
              </button>
            );
          })}
        </div>
      ) : (
        <div role="group" aria-label={yearMonth(locale, view.getUTCFullYear(), viewMonth + 1)}>
          <div className="mb-1 grid grid-cols-7 text-center text-xs text-muted">
            {weekdayNames(locale).map((day, index) => (
              <span key={day} className={`py-1 ${index === 0 ? "text-danger" : index === 6 ? "text-brand" : ""}`}>
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((date) => {
              const key = formatKST(date);
              const inMonth = date.getUTCMonth() === viewMonth;
              const isSelected = key === selected;
              const isToday = key === todayKey;
              const weekday = weekdayKST(date);
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={fullDate(locale, date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => onChoose(key)}
                  className={`mx-auto flex size-10 items-center justify-center rounded-full text-sm transition-colors ${
                    isSelected
                      ? "bg-brand font-bold text-brand-contrast"
                      : isToday
                        ? "font-bold text-brand ring-1 ring-brand"
                        : weekday === 0
                          ? "text-danger"
                          : weekday === 6
                            ? "text-brand"
                            : "text-foreground"
                  } ${inMonth ? "" : "opacity-35"} ${isSelected ? "" : "hover:bg-surface-hover"}`}
                >
                  {date.getUTCDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChoose(todayKey)} className={chip}>
          {t("today")}
        </button>
        <button type="button" onClick={() => onChoose(formatKST(addDays(today, 1)))} className={chip}>
          {t("tomorrow")}
        </button>
        <button type="button" onClick={() => onChoose(formatKST(addDays(today, 7)))} className={chip}>
          {t("inAWeek")}
        </button>
        {clearable && (
          <button type="button" onClick={() => onChoose("")} className={`${chip} text-muted`}>
            {t("noDate")}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              setTypedError(null);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              // 일정·할 일 폼 안에 있으므로 Enter가 폼 저장으로 번지지 않게 막는다.
              event.preventDefault();
              applyTyped();
            }}
            inputMode="numeric"
            placeholder={t("typedPlaceholder")}
            aria-label={t("typedLabel")}
            className="h-10 min-w-0 flex-1 rounded-xl bg-surface-hover px-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
          />
          <button
            type="button"
            disabled={!typed.trim()}
            onClick={applyTyped}
            className="h-10 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast disabled:opacity-40"
          >
            {t("apply")}
          </button>
        </div>
        {typedError && (
          <p role="alert" className="text-xs text-danger">
            {typedError}
          </p>
        )}
      </div>
    </div>
  );
}
