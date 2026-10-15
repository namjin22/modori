"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";

export type Choice = { value: string; label: string; color?: string };

/**
 * 목록에서 하나 고르는 칸(카테고리, 시간대). 누르면 떠 있는 창에 목록이 뜬다.
 * 브라우저 기본 선택칸(<select>)은 휴대폰에서 기기의 선택창(돌리는 바퀴·회색 목록)이 떠서 앱 화면과 모양이 달랐다(2026-10-15 요청).
 *
 * 폼에 실을 때는 name을 주면 숨은 칸으로 값이 실린다. 값을 부른 쪽이 쥐면(value + onChange) 그대로 따른다.
 */
export function ChoicePicker({
  label,
  name,
  options,
  value,
  defaultValue,
  onChange,
  disabled = false,
}: {
  // 버튼과 창 제목의 이름(화면 읽기). 예: "할 일 카테고리".
  label: string;
  name?: string;
  options: Choice[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const [own, setOwn] = useState(defaultValue ?? options[0]?.value ?? "");
  const [open, setOpen] = useState(false);
  const current = value ?? own;
  const selected = options.find((option) => option.value === current);

  function choose(next: string) {
    setOpen(false);
    if (next === current) return;
    setOwn(next);
    onChange?.(next);
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex h-12 w-full min-w-0 items-center gap-2.5 rounded-xl bg-surface-hover px-4 text-left text-[15px] disabled:opacity-50"
      >
        {selected?.color && (
          <span aria-hidden className="color-edge size-3 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />
        )}
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? "고르기"}</span>
        <Chevron />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        <ul role="radiogroup" aria-label={label} className="-mx-1 flex flex-col gap-1">
          {options.map((option) => {
            const isSelected = option.value === current;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => choose(option.value)}
                  className={`flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] transition-colors ${
                    isSelected ? "bg-brand-subtle font-semibold text-brand" : "hover:bg-surface-hover"
                  }`}
                >
                  {option.color && (
                    <span aria-hidden className="color-edge size-3 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {isSelected && (
                    <span aria-hidden className="text-sm">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>
    </>
  );
}

/** 칸 오른쪽의 ▾. 끝에서 띄워 둔다(글자와 붙어 보이지 않게). */
export function Chevron() {
  return (
    <svg
      aria-hidden
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-muted"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
