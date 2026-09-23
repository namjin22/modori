/**
 * 카테고리에 고를 수 있는 색. 무지개 순서대로 두고 흰색과 검정을 끝에 붙인다.
 * 색이 많으면 무엇을 골랐는지 기억하지 못하고, 비슷한 색끼리 구별도 안 된다.
 *
 * 흰색과 검정은 화면 배경과 같아질 수 있다. 색을 그리는 곳에는 얇은 테두리를
 * 둘러서 배경에 묻히지 않게 한다.
 */
export const PALETTE = [
  { value: "#ef4444", name: "빨강" },
  { value: "#f97316", name: "주황" },
  { value: "#facc15", name: "노랑" },
  { value: "#22c55e", name: "초록" },
  { value: "#3b82f6", name: "파랑" },
  { value: "#8b5cf6", name: "보라" },
  { value: "#ffffff", name: "흰색" },
  { value: "#111827", name: "검정" },
] as const;

/** 일정은 색을 고르지 않는다. 달력에서 이름으로 알아보므로 파랑으로 고정한다. */
export const DEFAULT_EVENT_COLOR = "#3b82f6";

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
