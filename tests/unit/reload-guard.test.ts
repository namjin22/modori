import { describe, expect, it } from "vitest";

import { isLoadFailure } from "@/lib/reload-guard";

describe("다시 불러오면 낫는 오류", () => {
  it("끊긴 요청과 사라진 조각 파일은 맞고, 그 밖의 오류는 아니다", () => {
    expect(isLoadFailure(new TypeError("Load failed"))).toBe(true);
    expect(isLoadFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isLoadFailure(new TypeError("NetworkError when attempting to fetch resource."))).toBe(true);
    const chunk = new Error("Loading chunk 12 failed.");
    chunk.name = "ChunkLoadError";
    expect(isLoadFailure(chunk)).toBe(true);
    expect(isLoadFailure(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(isLoadFailure("Load failed")).toBe(false);
  });
});
