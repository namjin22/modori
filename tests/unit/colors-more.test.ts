import { describe, expect, it } from "vitest";

import { hexToHsv, hsvToHex, isHexColor, MORE_COLORS, normalizeHex } from "@/lib/colors";

describe("더 많은 색(2026-10-19)", () => {
  it("100색이고 모두 저장할 수 있는 꼴이며 겹치지 않는다", () => {
    expect(MORE_COLORS).toHaveLength(100);
    expect(MORE_COLORS.every(isHexColor)).toBe(true);
    expect(new Set(MORE_COLORS).size).toBe(100);
  });

  it("색상 코드는 #·대소문자·세 자리를 받아 #rrggbb 소문자로 바꾸고, 아닌 것은 버린다", () => {
    expect(normalizeHex("3B82F6")).toBe("#3b82f6");
    expect(normalizeHex(" #3b82f6 ")).toBe("#3b82f6");
    expect(normalizeHex("#38f")).toBe("#3388ff");
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex("url(x)")).toBeNull();
  });

  it("색 판의 색상·채도·밝기와 색상 코드가 서로 오간다", () => {
    expect(hsvToHex(0, 1, 1)).toBe("#ff0000");
    expect(hsvToHex(120, 1, 1)).toBe("#00ff00");
    expect(hsvToHex(240, 1, 0.5)).toBe("#000080");
    expect(hsvToHex(0, 0, 1)).toBe("#ffffff");
    for (const hex of ["#3b82f6", "#22c55e", "#facc15", "#111827", "#ffffff"]) {
      const { h, s, v } = hexToHsv(hex);
      expect(hsvToHex(h, s, v)).toBe(hex);
    }
  });

  it("색이 아닌 글은 저장할 수 없다", () => {
    expect(isHexColor("#3b82f6")).toBe(true);
    expect(isHexColor("#3b82f6;background:url(x)")).toBe(false);
    expect(isHexColor("blue")).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });
});
