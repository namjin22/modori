/** 일정의 기본 색. 일정도 할 일처럼 팔레트에서 색을 고를 수 있고(2026-10-13), 고르지 않으면 파랑이다. */
export const DEFAULT_EVENT_COLOR = "#2563eb";

/**
 * 카테고리도 따로 고른 색도 없는 할 일을 달력에 채울 때 쓰는 회색. 2026-11-27부터 일정·카테고리·반복 일정에서 색을 고르지 않은
 * "색 없음"도 이 회색으로 저장한다(색 고르기에는 처음부터 있는 색이 없다, components/color-swatches.tsx).
 */
export const NO_CATEGORY_COLOR = "#8b95a1";

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

/**
 * "새 색 만들기" 창의 대표 색 열둘(2026-11-26 운영자 요청). 예전에는 파스텔 100색 표였는데 쓰지 않는 색이 대부분이라 줄였다.
 * 표에 없는 색은 색상 코드나 색 판 직접 찍기로 만든다. 검정은 어두운 화면에서 배경에 묻혀 뺐고, 흰색은 색 고르기에 처음부터 있다.
 * 이름의 MORE는 예전 "더 많은 색" 창에서 왔다.
 */
export const MORE_COLORS: string[] = [
  "#dc2626", // 빨강
  "#f97316", // 주황
  "#facc15", // 노랑
  "#84cc16", // 연두
  "#22c55e", // 초록
  "#14b8a6", // 청록
  "#38bdf8", // 하늘
  "#2563eb", // 파랑
  "#7c3aed", // 보라
  "#ec4899", // 분홍
  "#92400e", // 갈색
  "#6b7280", // 회색
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
