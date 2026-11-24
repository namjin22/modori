"use client";

import type { ReactNode, Ref } from "react";

/**
 * 할 일·일정 창의 "따로 넘어가는 칸"(2026-11-24 요청: 세부 할 일·메모까지 한 화면에 다 떠서 조잡하다).
 * 창의 첫 화면에는 한 줄짜리 버튼(DetailRow)만 두고, 누르면 같은 창 안에서 그 칸만 보이는 화면으로 넘어간다(DetailHeader로 돌아온다).
 * 창의 이름(제목)은 그대로 둔다. 화면 읽기가 어느 창 안에 있는지 계속 알 수 있게.
 */

/** 첫 화면의 한 줄: 왼쪽에 이름, 오른쪽에 지금 값의 요약과 › . 이름과 요약이 함께 버튼의 이름이 된다. */
export function DetailRow({
  label,
  summary,
  onOpen,
  buttonRef,
}: {
  label: string;
  summary: string;
  onOpen: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      className="flex h-12 w-full items-center gap-3 px-4 text-left text-sm transition-colors hover:bg-surface-hover"
    >
      <span className="shrink-0 font-medium">{label}</span>
      {/* 사이의 공백: 화면 읽기가 이름과 요약을 붙여 읽지 않게("메모없음"이 아니라 "메모 없음"). */}{" "}
      <span className="min-w-0 flex-1 truncate text-right text-muted">{summary}</span>
      <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted">
        <path d="M9 5 L16 12 L9 19" />
      </svg>
    </button>
  );
}

/** DetailRow 여럿을 한 상자에 줄로 나눠 담는다. */
export function DetailRows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">{children}</div>;
}

/** 넘어간 화면의 머리줄: 첫 화면으로 돌아가는 ‹ 와 그 칸의 이름. */
export function DetailHeader({ title, backLabel, onBack }: { title: string; backLabel: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-hover"
      >
        <svg aria-hidden width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5 L8 12 L15 19" />
        </svg>
      </button>
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

/** 메모 요약: 첫 줄만, 비었으면 none. 길면 줄 끝에서 잘린다(DetailRow가 truncate). */
export function memoSummary(memo: string, none: string): string {
  const first = memo.trim().split("\n")[0]?.trim() ?? "";
  return first || none;
}
