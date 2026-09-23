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

/** 색의 상대 휘도(WCAG). 읽을 수 없는 값이면 null. */
function luminance(color: string): number | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return null;

  const channels = [0, 2, 4].map(
    (offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255,
  );
  const [r, g, b] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 색 칩·완료 체크처럼 굵은 글씨나 아이콘을 색 위에 올릴 때 쓴다.
 * 흰 글씨와 3:1 이상 벌어지면 흰색을 쓴다. 파랑·빨강·보라에 대비만 보고 검정을
 * 올리면 탁해 보인다. 노랑·초록·주황·흰색처럼 밝은 색에만 어두운 글씨를 쓴다.
 */
export function onColorText(background: string): "#ffffff" | "#191f28" {
  const value = luminance(background);
  if (value === null) return "#191f28";
  return 1.05 / (value + 0.05) >= 3 ? "#ffffff" : "#191f28";
}

/** 색상 위에 올릴 글자 중 대비가 더 큰 색을 고른다. 작은 글씨처럼 대비가 꼭 필요할 때 쓴다. */
export function contrastTextColor(background: string): "#ffffff" | "#191f28" {
  const value = luminance(background);
  if (value === null) return "#191f28";

  const whiteContrast = 1.05 / (value + 0.05);
  const darkContrast = (value + 0.05) / 0.05;
  return whiteContrast >= darkContrast ? "#ffffff" : "#191f28";
}
