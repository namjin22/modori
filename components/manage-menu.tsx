"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** 홈의 일정 칸이 들으면 만들기 칸을 연다(components/event-section.tsx). */
export const NEW_EVENT_EVENT = "modori:new-event";

/**
 * 카테고리·일정·루틴으로 가는 메뉴(2026-10-19 요청). 버튼 하나를 누르면 세 가지가 튀어나온다.
 * 예전에는 알약 버튼이 따로 늘어서 있었다. 일정은 다른 화면으로 가지 않고 이 화면의 일정 만들기 칸을 연다.
 */
export function ManageMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // 바깥을 누르거나 Esc를 누르면 닫는다.
  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex h-12 w-full animate-rise items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium hover:bg-surface-hover focus-visible:bg-surface-hover";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label="관리 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-colors ${
          open ? "bg-foreground text-background" : "bg-surface text-muted hover:text-foreground"
        }`}
      >
        <MenuIcon open={open} />
        관리
      </button>

      {open && (
        <div
          role="menu"
          aria-label="관리 메뉴"
          // 버튼 아래에서 커지며 튀어나온다. 항목은 조금씩 늦게 떠오른다.
          className="absolute left-0 top-10 z-30 flex w-48 origin-top-left animate-pop flex-col gap-0.5 rounded-2xl border border-border bg-surface p-1.5 shadow-xl"
        >
          <Link prefetch={false} href="/categories" role="menuitem" className={item} onClick={() => setOpen(false)}>
            <Glyph>🏷️</Glyph>
            카테고리
          </Link>
          <button
            type="button"
            role="menuitem"
            className={item}
            style={{ animationDelay: "40ms" }}
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event(NEW_EVENT_EVENT));
            }}
          >
            <Glyph>📅</Glyph>
            일정
          </button>
          <Link
            prefetch={false}
            href="/routines"
            role="menuitem"
            className={item}
            style={{ animationDelay: "80ms" }}
            onClick={() => setOpen(false)}
          >
            <Glyph>🔁</Glyph>
            루틴
          </Link>
        </div>
      )}
    </div>
  );
}

function Glyph({ children }: { children: string }) {
  return (
    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-base">
      {children}
    </span>
  );
}

/** 세 줄(햄버거). 열리면 X로 바뀐다. */
function MenuIcon({ open }: { open: boolean }) {
  const line = "absolute left-0 h-0.5 w-3.5 rounded-full bg-current transition-transform duration-200";
  return (
    <span aria-hidden className="relative block h-3 w-3.5">
      <span className={`${line} top-0 ${open ? "translate-y-[5px] rotate-45" : ""}`} />
      <span className={`${line} top-[5px] ${open ? "scale-x-0" : ""}`} />
      <span className={`${line} top-[10px] ${open ? "-translate-y-[5px] -rotate-45" : ""}`} />
    </span>
  );
}
