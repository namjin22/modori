import { describe, expect, it } from "vitest";

import { MAX_MEMO_LENGTH, readMemo } from "@/lib/memo";

describe("readMemo", () => {
  it("앞뒤 공백을 자르고 줄바꿈은 둔다", () => {
    expect(readMemo("  준비물: 계산기\n범위: 3단원  ")).toBe("준비물: 계산기\n범위: 3단원");
  });

  it("비우면 메모 없음(null)", () => {
    expect(readMemo("   ")).toBeNull();
  });

  it("칸이 없던 요청은 undefined라 건드리지 않는다", () => {
    expect(readMemo(null)).toBeUndefined();
  });

  it("너무 길면 자른다", () => {
    expect(readMemo("가".repeat(MAX_MEMO_LENGTH + 10))).toHaveLength(MAX_MEMO_LENGTH);
  });
});
