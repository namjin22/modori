"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Bubble = {
  key: number;
  text: string;
  top: number;
  left: number;
  container: HTMLElement;
};

// 말풍선을 읽을 시간. 짧으면 놓치고, 길면 다음 입력을 가린다.
const VISIBLE_MS = 2500;

function messageOf(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const custom = field.dataset.invalidMessage;
  if (custom) return custom;

  const { validity } = field;
  if (validity.valueMissing) {
    return field instanceof HTMLInputElement && field.type === "date"
      ? "날짜를 골라주세요"
      : "내용을 적어주세요";
  }
  if (validity.tooLong || validity.tooShort) return "글자 수를 확인해주세요";
  return "입력한 내용을 확인해주세요";
}

/**
 * 필수 칸을 비운 채 보내면 브라우저가 띄우는 기본 말풍선("이 입력란을 작성하세요")을 막고,
 * 같은 자리에 모도리 모양의 말풍선을 띄운다. 루트 레이아웃에 한 번만 둔다.
 *
 * 브라우저 말풍선은 운영체제마다 모양이 달라 앱과 따로 논다. 폼마다 검사를 새로 짜는 대신
 * 브라우저가 이미 하는 검사(required, maxLength 등)를 그대로 쓰고 보이는 것만 바꾼다.
 * 칸이 창(<dialog>) 안에 있으면 창 안에 그린다. 바깥에 그리면 창 뒤로 숨는다.
 */
export function ValidationBubble() {
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const shownAt = useRef(0);

  useEffect(() => {
    function onInvalid(event: Event) {
      const field = event.target;
      if (
        !(field instanceof HTMLInputElement) &&
        !(field instanceof HTMLTextAreaElement) &&
        !(field instanceof HTMLSelectElement)
      ) {
        return;
      }
      event.preventDefault();

      // 한 폼에서 여러 칸이 한꺼번에 걸리면 첫 칸만 알린다.
      const now = performance.now();
      if (now - shownAt.current < 100) return;
      shownAt.current = now;

      field.focus();
      const container = field.closest("dialog") ?? document.body;
      const box = field.getBoundingClientRect();
      const base = container.getBoundingClientRect();
      setBubble({
        key: now,
        text: messageOf(field),
        top: box.bottom - base.top + container.scrollTop + 8,
        left: Math.max(8, box.left - base.left + 8),
        container,
      });
    }

    document.addEventListener("invalid", onInvalid, true);
    return () => document.removeEventListener("invalid", onInvalid, true);
  }, []);

  useEffect(() => {
    if (!bubble) return;
    const hide = () => setBubble(null);
    const timer = setTimeout(hide, VISIBLE_MS);
    // 다시 적기 시작하면 바로 치운다.
    document.addEventListener("input", hide, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("input", hide, true);
    };
  }, [bubble]);

  if (!bubble) return null;

  return createPortal(
    <div
      key={bubble.key}
      role="alert"
      className="pointer-events-none absolute z-50 [animation:toast-in_0.15s_ease-out_both]"
      style={{ top: bubble.top, left: bubble.left }}
    >
      {/* 칸을 가리키는 꼬리 */}
      <span
        aria-hidden
        className="absolute -top-1 left-4 size-2.5 rotate-45 bg-foreground"
      />
      <span className="relative block rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background shadow-lg">
        {bubble.text}
      </span>
    </div>,
    bubble.container,
  );
}
