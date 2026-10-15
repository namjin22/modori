"use client";

import { useState } from "react";

import { Chevron } from "@/components/choice-picker";
import { Modal } from "@/components/modal";
import { formatReminderMinute } from "@/lib/reminder";

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
const pad = (value: number) => String(value).padStart(2, "0");


/**
 * 시각을 고르는 칸. 누르면 떠 있는 창에서 오전·오후, 시, 분(5분 단위)을 눌러 고른다.
 * 휴대폰 기본 선택창(돌리는 바퀴·목록)은 앱 화면과 모양이 달라 어색했다(2026-10-15 요청).
 * 값은 자정부터 몇 분째(0~1435)로 주고받는다.
 */
export function TimeSheet({
  label,
  value,
  onChange,
  optional = false,
  fallback = 9 * 60,
}: {
  // 창 제목이자 버튼의 이름(화면 읽기). 예: "알림 시각", "새 일정 시작 시간".
  label: string;
  // 비어 있으면(null) "없음". optional일 때만 비울 수 있다.
  value: number | null;
  onChange: (minute: number | null) => void;
  optional?: boolean;
  // 비어 있는 칸을 열었을 때 처음 보일 시각.
  fallback?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? fallback);
  const hour24 = Math.floor(draft / 60);
  const pm = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minute = draft % 60;

  const set = (next: { pm?: boolean; hour12?: number; minute?: number }) => {
    const isPm = next.pm ?? pm;
    const h = (next.hour12 ?? hour12) % 12;
    setDraft((isPm ? h + 12 : h) * 60 + (next.minute ?? minute));
  };

  const cell = (selected: boolean) =>
    `flex h-11 items-center justify-center rounded-xl text-[15px] tabular-nums transition-colors ${
      selected ? "bg-brand font-semibold text-brand-contrast" : "bg-surface-hover text-foreground hover:bg-border/60"
    }`;

  return (
    <>
      <button
        type="button"
        aria-label={`${label} ${value === null ? "없음" : formatReminderMinute(value)}, 바꾸기`}
        aria-haspopup="dialog"
        onClick={() => {
          setDraft(value ?? fallback);
          setOpen(true);
        }}
        className="flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl bg-surface-hover px-4 text-[15px] font-medium tabular-nums"
      >
        <span className={value === null ? "text-muted" : ""}>{value === null ? "없음" : formatReminderMinute(value)}</span>
        <Chevron />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        <p aria-live="polite" className="text-center text-3xl font-bold tabular-nums">
          {formatReminderMinute(draft)}
        </p>

        <div role="radiogroup" aria-label="오전·오후" className="flex gap-1 rounded-xl bg-surface-hover p-1">
          {[false, true].map((isPm) => (
            <button
              key={String(isPm)}
              type="button"
              role="radio"
              aria-checked={pm === isPm}
              onClick={() => set({ pm: isPm })}
              className={`h-10 flex-1 rounded-lg text-sm transition-colors ${
                pm === isPm ? "bg-surface font-semibold text-foreground shadow-sm" : "text-muted"
              }`}
            >
              {isPm ? "오후" : "오전"}
            </button>
          ))}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs text-muted">시</legend>
          <div role="radiogroup" aria-label="시" className="grid grid-cols-6 gap-1.5">
            {HOURS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={hour12 === option}
                aria-label={`${option}시`}
                onClick={() => set({ hour12: option })}
                className={cell(hour12 === option)}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs text-muted">분</legend>
          <div role="radiogroup" aria-label="분" className="grid grid-cols-6 gap-1.5">
            {MINUTES.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={minute === option}
                aria-label={`${option}분`}
                onClick={() => set({ minute: option })}
                className={cell(minute === option)}
              >
                {pad(option)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className={`grid gap-2 ${optional ? "grid-cols-3" : "grid-cols-2"}`}>
          <button type="button" onClick={() => setOpen(false)} className="h-12 rounded-xl bg-surface-hover text-sm font-semibold">
            취소
          </button>
          {/* 끝 시간처럼 안 정해도 되는 칸은 비울 수 있다. */}
          {optional && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (value !== null) onChange(null);
              }}
              className="h-12 rounded-xl bg-surface-hover text-sm font-semibold text-muted"
            >
              없음
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (draft !== value) onChange(draft);
            }}
            className="h-12 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
          >
            확인
          </button>
        </div>
      </Modal>
    </>
  );
}
