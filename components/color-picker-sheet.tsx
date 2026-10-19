"use client";

import { type PointerEvent, useRef, useState } from "react";

import { Modal } from "@/components/modal";
import { hexToHsv, hsvToHex, MORE_COLORS, normalizeHex } from "@/lib/colors";

/**
 * "더 많은 색" 창(2026-10-19 요청). 100색 격자에서 고르거나, 색 판을 직접 찍거나, 색상 코드를 친다.
 * 휴대폰 기본 색 선택창은 기기마다 모양이 달라 쓰지 않고 직접 그린다(새 의존성 없이 CSS 그라데이션과 포인터 좌표로).
 */
export function ColorPickerSheet({
  open,
  initial,
  onClose,
  onPick,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onPick: (hex: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="색 고르기">
      {/* 열 때마다 지금 색에서 시작하도록 새로 그린다. */}
      {open && <PickerBody initial={initial} onCancel={onClose} onPick={onPick} />}
    </Modal>
  );
}

function PickerBody({ initial, onCancel, onPick }: { initial: string; onCancel: () => void; onPick: (hex: string) => void }) {
  // 고른 색은 그대로 쥔다(목록·코드로 고른 색이 색 판을 거치며 한 끗 바뀌지 않게). 색 판 위치는 따로 쥔다.
  const [hex, setHex] = useState(initial);
  const [hsv, setHsv] = useState(() => hexToHsv(initial));
  const [typed, setTyped] = useState(initial);
  const typedValid = normalizeHex(typed) !== null;

  function choose(next: string) {
    setHex(next);
    setHsv(hexToHsv(next));
    setTyped(next);
  }

  function fromHsv(next: { h: number; s: number; v: number }) {
    const value = hsvToHex(next.h, next.s, next.v);
    setHsv(next);
    setHex(value);
    setTyped(value);
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <span aria-hidden className="color-edge size-12 shrink-0 rounded-2xl" style={{ backgroundColor: hex }} />
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted">
          색상 코드
          <input
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              const parsed = normalizeHex(event.target.value);
              if (parsed) {
                setHex(parsed);
                setHsv(hexToHsv(parsed));
              }
            }}
            maxLength={7}
            spellCheck={false}
            autoCapitalize="off"
            aria-label="색상 코드"
            aria-invalid={!typedValid}
            placeholder="#3b82f6"
            className={`h-11 rounded-xl bg-surface-hover px-3 font-mono text-[15px] text-foreground outline-none focus:ring-2 ${
              typedValid ? "focus:ring-brand" : "ring-2 ring-danger"
            }`}
          />
        </label>
      </div>

      <section aria-label="직접 고르기" className="flex flex-col gap-2">
        <SaturationPlane hsv={hsv} onChange={fromHsv} />
        <HueBar hue={hsv.h} onChange={(h) => fromHsv({ ...hsv, h })} />
      </section>

      <section aria-label="색 목록" className="flex flex-col gap-2">
        <p className="text-xs text-muted">색 목록</p>
        <div className="grid grid-cols-10 gap-1.5">
          {MORE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              aria-pressed={color === hex}
              onClick={() => choose(color)}
              className={`color-edge aspect-square rounded-md ${color === hex ? "ring-2 ring-foreground ring-offset-1 ring-offset-surface" : ""}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="h-12 rounded-xl bg-surface-hover text-sm font-semibold">
          취소
        </button>
        <button
          type="button"
          disabled={!typedValid}
          onClick={() => onPick(hex)}
          className="h-12 rounded-xl bg-brand text-sm font-semibold text-brand-contrast disabled:opacity-50"
        >
          이 색 쓰기
        </button>
      </div>
    </>
  );
}

/** 누르거나 끄는 동안 포인터 위치를 0~1 비율로 알려 준다. 손가락으로 끌 때 화면이 같이 스크롤되지 않게 touch-none. */
function usePointerRatio(onRatio: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  function update(event: PointerEvent<HTMLDivElement>) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    onRatio(x, y);
  }
  return {
    ref,
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      update(event);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event);
    },
  };
}

/** 채도(가로)·밝기(세로) 판. 위 오른쪽이 가장 진하고 밝은 색, 아래가 검정이다. */
function SaturationPlane({ hsv, onChange }: { hsv: { h: number; s: number; v: number }; onChange: (next: { h: number; s: number; v: number }) => void }) {
  const pointer = usePointerRatio((x, y) => onChange({ h: hsv.h, s: x, v: 1 - y }));
  return (
    <div
      {...pointer}
      role="slider"
      aria-label="채도와 밝기"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(hsv.v * 100)}
      aria-valuetext={`채도 ${Math.round(hsv.s * 100)}%, 밝기 ${Math.round(hsv.v * 100)}%`}
      tabIndex={0}
      onKeyDown={(event) => {
        const step = 0.05;
        const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        onChange({ h: hsv.h, s: Math.min(1, Math.max(0, hsv.s + move[0])), v: Math.min(1, Math.max(0, hsv.v + move[1])) });
      }}
      className="relative h-36 cursor-crosshair touch-none rounded-xl"
      style={{
        backgroundColor: hsvToHex(hsv.h, 1, 1),
        backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
        style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hsvToHex(hsv.h, hsv.s, hsv.v) }}
      />
    </div>
  );
}

/** 색상 막대(빨강→노랑→초록→파랑→보라→빨강). */
function HueBar({ hue, onChange }: { hue: number; onChange: (h: number) => void }) {
  const pointer = usePointerRatio((x) => onChange(Math.min(359.9, x * 360)));
  return (
    <div
      {...pointer}
      role="slider"
      aria-label="색상"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hue)}
      tabIndex={0}
      onKeyDown={(event) => {
        const delta = event.key === "ArrowLeft" ? -10 : event.key === "ArrowRight" ? 10 : 0;
        if (!delta) return;
        event.preventDefault();
        onChange((hue + delta + 360) % 360);
      }}
      className="relative h-6 cursor-pointer touch-none rounded-full"
      style={{ backgroundImage: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
        style={{ left: `${(hue / 360) * 100}%`, backgroundColor: hsvToHex(hue, 1, 1) }}
      />
    </div>
  );
}
