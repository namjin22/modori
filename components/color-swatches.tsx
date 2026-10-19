"use client";

import { useEffect, useRef, useState } from "react";

import { ColorPickerSheet } from "@/components/color-picker-sheet";
import { isPaletteColor, PALETTE } from "@/lib/colors";

const SWATCH =
  "color-edge relative flex aspect-square w-full cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-surface has-[:checked]:ring-2 has-[:checked]:ring-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand";

/**
 * 색 고르기. 자주 쓰는 8색은 라디오 버튼이라 폼으로 그대로 전송된다. 그 밖의 색은 "더 많은 색" 창(100색·직접 찍기·색상 코드,
 * components/color-picker-sheet.tsx)에서 고르고, 고른 색은 8색 옆에 한 칸으로 붙어 같은 라디오로 전송된다(2026-10-19 요청).
 */
export function ColorSwatches({
  name,
  defaultValue,
  legend,
}: {
  name: string;
  defaultValue: string;
  legend: string;
}) {
  // 8색 밖의 색(예전에 고른 색이나 더 많은 색에서 고른 색). 그대로 보여 주지 않으면 아무것도 고르지 않은 상태가 되어 저장이 조용히 무시된다.
  const [custom, setCustom] = useState<string | null>(defaultValue && !isPaletteColor(defaultValue) ? defaultValue : null);
  const [picking, setPicking] = useState(false);
  // 창을 열 때의 색(지금 고른 칸). 누르는 순간 읽어 둔다.
  const [pickerStart, setPickerStart] = useState(defaultValue);
  const [justPicked, setJustPicked] = useState(false);
  const customRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  // 창에서 고른 색을 바로 고른 상태로 둔다(라디오는 폼이 쥐고 있어 그려진 뒤에 체크한다).
  useEffect(() => {
    if (!justPicked || !customRef.current) return;
    customRef.current.checked = true;
    setJustPicked(false);
  }, [justPicked, custom]);

  const current = () => groupRef.current?.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? defaultValue;

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-2 text-xs text-muted">{legend}</legend>
      {/* 칸 수만큼 똑같이 나눈 격자라 폭이 좁으면 견본이 같이 작아진다(최대 28px).
          크기를 정해 두면 가장 좁은 폰에서 마지막 하나가 다음 줄로 떨어진다. */}
      <div
        ref={groupRef}
        className="grid gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${PALETTE.length + 1 + (custom ? 1 : 0)}, minmax(0, 1.75rem))` }}
      >
        {PALETTE.map((color) => (
          <label key={color.value} title={color.name} className={SWATCH} style={{ backgroundColor: color.value }}>
            <input
              type="radio"
              name={name}
              value={color.value}
              defaultChecked={defaultValue === color.value}
              aria-label={color.name}
              className="absolute inset-0 m-0 cursor-pointer appearance-none rounded-full"
            />
          </label>
        ))}
        {custom && (
          <label title={custom} className={SWATCH} style={{ backgroundColor: custom }}>
            <input
              ref={customRef}
              type="radio"
              name={name}
              value={custom}
              defaultChecked={defaultValue === custom}
              aria-label={`고른 색 ${custom}`}
              className="absolute inset-0 m-0 cursor-pointer appearance-none rounded-full"
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => {
            setPickerStart(current());
            setPicking(true);
          }}
          aria-label="더 많은 색"
          title="더 많은 색"
          className="relative flex aspect-square w-full items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundImage: "conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)" }}
        >
          <span aria-hidden className="flex size-[60%] items-center justify-center rounded-full bg-surface text-foreground">
            +
          </span>
        </button>
      </div>

      <ColorPickerSheet
        open={picking}
        initial={pickerStart}
        onClose={() => setPicking(false)}
        onPick={(hex) => {
          setPicking(false);
          const base = groupRef.current?.querySelector<HTMLInputElement>(`input[name="${name}"][value="${hex}"]`);
          // 8색 중 하나를 골랐으면 그 칸을 고르고, 아니면 고른 색 칸을 새로 둔다.
          if (base && isPaletteColor(hex)) {
            base.checked = true;
            return;
          }
          setCustom(hex);
          setJustPicked(true);
        }}
      />
    </fieldset>
  );
}
