import type { CSSProperties } from "react";

/**
 * 일정과 할 일에 고를 수 있는 색. 아무 색이나 받으면 글자가 안 읽히는 조합이
 * 생기므로, 흰 글씨와 옅은 배경 양쪽에서 읽히는 색만 둔다.
 */
export const PALETTE = [
  { value: "#00b26a", name: "초록" },
  { value: "#3b82f6", name: "파랑" },
  { value: "#f59e0b", name: "주황" },
  { value: "#ef4444", name: "빨강" },
  { value: "#ec4899", name: "분홍" },
  { value: "#8b5cf6", name: "보라" },
  { value: "#14b8a6", name: "청록" },
  { value: "#64748b", name: "회색" },
] as const;

export const DEFAULT_EVENT_COLOR = PALETTE[1].value;

export function isPaletteColor(value: string): boolean {
  return PALETTE.some((color) => color.value === value);
}

/** 색상 위에 올릴 글자 중 대비가 더 큰 색을 고른다. 사용자 색상도 안전하게 처리한다. */
export function contrastTextColor(background: string): "#ffffff" | "#191f28" {
  const match = /^#([0-9a-f]{6})$/i.exec(background);
  if (!match) return "#191f28";

  const channels = [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255);
  const linearChannels = channels.map((channel) => {
    const linear = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return linear;
  });
  const relativeLuminance =
    0.2126 * linearChannels[0] + 0.7152 * linearChannels[1] + 0.0722 * linearChannels[2];
  const whiteContrast = 1.05 / (relativeLuminance + 0.05);
  const darkContrast = (relativeLuminance + 0.05) / 0.05;
  return whiteContrast >= darkContrast ? "#ffffff" : "#191f28";
}

/**
 * 완료한 할 일만큼 날짜 칸을 아래부터 채운다. 할 일 하나가 칸의 1/전체 만큼이고,
 * 그 할 일의 색으로 칠한다. 다 끝내면 칸이 꽉 찬다.
 * 색은 옅게(약 33%) 깔아서 날짜 숫자와 일정 칩이 묻히지 않게 한다.
 */
export function dayFillStyle(
  doneColors: string[],
  total: number,
): CSSProperties | undefined {
  if (total === 0 || doneColors.length === 0) return undefined;

  const step = 100 / total;
  const stops = doneColors.map(
    (color, index) =>
      `${color}55 ${(index * step).toFixed(2)}% ${((index + 1) * step).toFixed(2)}%`,
  );
  const filled = (doneColors.length * step).toFixed(2);

  return {
    backgroundImage: `linear-gradient(to top, ${stops.join(", ")}, transparent ${filled}%)`,
  };
}
