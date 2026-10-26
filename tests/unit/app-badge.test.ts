import { describe, expect, it } from "vitest";

import { BADGE_MAX, badgeLabel } from "@/lib/app-badge";

describe("badgeLabel", () => {
  it("0이거나 읽을 수 없는 수면 비운다(아이콘의 숫자를 지운다)", () => {
    expect(badgeLabel(0)).toBe("");
    expect(badgeLabel(-3)).toBe("");
    expect(badgeLabel(Number.NaN)).toBe("");
  });

  it("그대로 적다가 99를 넘으면 99+", () => {
    expect(badgeLabel(1)).toBe("1");
    expect(badgeLabel(12)).toBe("12");
    expect(badgeLabel(BADGE_MAX)).toBe("99");
    expect(badgeLabel(BADGE_MAX + 1)).toBe("99+");
    expect(badgeLabel(1000)).toBe("99+");
  });
});
