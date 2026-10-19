/**
 * 카테고리에 고를 수 있는 색. 무지개 순서대로 두고 흰색과 검정을 끝에 붙인다.
 * 색이 많으면 무엇을 골랐는지 기억하지 못하고, 비슷한 색끼리 구별도 안 된다.
 *
 * 흰색과 검정은 화면 배경과 같아질 수 있다. 색을 그리는 곳에는 얇은 테두리를
 * 둘러서 배경에 묻히지 않게 한다.
 */
export const PALETTE = [
  { value: "#dc2626", name: "빨강" },
  { value: "#f97316", name: "주황" },
  { value: "#facc15", name: "노랑" },
  { value: "#22c55e", name: "초록" },
  { value: "#2563eb", name: "파랑" },
  { value: "#7c3aed", name: "보라" },
  { value: "#ffffff", name: "흰색" },
  { value: "#111827", name: "검정" },
] as const;

/** 일정의 기본 색. 일정도 할 일처럼 팔레트에서 색을 고를 수 있고(2026-10-13), 고르지 않으면 파랑이다. */
export const DEFAULT_EVENT_COLOR = "#2563eb";

/** 카테고리도 따로 고른 색도 없는 할 일을 달력에 채울 때 쓰는 회색. */
export const NO_CATEGORY_COLOR = "#8b95a1";

export function isPaletteColor(value: string): boolean {
  return PALETTE.some((color) => color.value === value);
}

/**
 * 저장할 수 있는 색인가. 기본 팔레트 밖의 색도 고를 수 있게 되면서(2026-10-19 요청: 100색, 색상 코드, 직접 찍기) "#rrggbb" 꼴이면 받는다.
 * 모양을 엄격히 봐서 색이 아닌 글이 style로 들어가지 않게 한다.
 */
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

/** 사람이 친 색상 코드를 저장할 꼴("#rrggbb", 소문자)로. "3B82F6"·"#3b82f6"·"#38f"를 받는다. 아니면 null. */
export function normalizeHex(raw: string): string | null {
  const text = raw.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(text)) return `#${[...text].map((c) => c + c).join("")}`;
  return /^[0-9a-f]{6}$/.test(text) ? `#${text}` : null;
}

const toHex = (channel: number) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, "0");

/** 색상환(h 0~360)·채도(s 0~1)·밝기(v 0~1)를 "#rrggbb"로. 직접 찍는 색 판이 쓴다. */
export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${toHex(f(5) * 255)}${toHex(f(3) * 255)}${toHex(f(1) * 255)}`;
}

/** "#rrggbb"를 색상환·채도·밝기로. 색 판을 열 때 지금 색의 자리를 찾는다. */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const [r, g, b] = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return `#${toHex(f(0) * 255)}${toHex(f(8) * 255)}${toHex(f(4) * 255)}`;
}

// 더 많은 색: 파스텔 색상 10가지 × 톤 9단계 + 바탕·회색 10 = 100색. 손으로 적으면 오타가 나서 공식으로 만든다.
// 처음엔 색상환을 고르게 나눈 진한 색이었는데 "그냥 배열된 색"처럼 보인다는 의견을 받았다(2026-10-19).
// 아주 연한 톤부터 차분한 톤까지 채도를 낮게 두고, 흰 글씨가 필요한 어두운 끝은 맨 아래 두 줄만 남겼다.
const MORE_HUES = [345, 10, 28, 48, 88, 150, 180, 205, 232, 268];
const MORE_TONES: [saturation: number, lightness: number][] = [
  [0.75, 0.94],
  [0.7, 0.9],
  [0.66, 0.86],
  [0.62, 0.82],
  [0.56, 0.78],
  [0.5, 0.74],
  [0.44, 0.7],
  [0.36, 0.65],
  [0.26, 0.58],
];
export const MORE_COLORS: string[] = [
  ...MORE_TONES.flatMap(([s, l]) => MORE_HUES.map((h) => hslToHex(h, s, l))),
  "#fbf8f3",
  "#f3ece2",
  "#e8dfd3",
  "#d6cbbd",
  "#b9ad9f",
  "#e9edf2",
  "#cfd6df",
  "#a5afbc",
  "#6b7280",
  "#374151",
];

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
  // 칩 글씨는 14px 안팎이라 작은 글자 기준(4.5:1)을 쓴다. 빨강·파랑·보라는 흰 글씨가 이 기준을
  // 넘도록 한 단계 진한 색(600)을 팔레트에 둔다.
  return 1.05 / (value + 0.05) >= 4.5 ? "#ffffff" : "#191f28";
}

/** 색상 위에 올릴 글자 중 대비가 더 큰 색을 고른다. 작은 글씨처럼 대비가 꼭 필요할 때 쓴다. */
export function contrastTextColor(background: string): "#ffffff" | "#191f28" {
  const value = luminance(background);
  if (value === null) return "#191f28";

  const whiteContrast = 1.05 / (value + 0.05);
  const darkContrast = (value + 0.05) / 0.05;
  return whiteContrast >= darkContrast ? "#ffffff" : "#191f28";
}
