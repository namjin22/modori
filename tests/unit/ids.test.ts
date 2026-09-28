import { describe, expect, it } from "vitest";

import { isId, readIdList } from "@/lib/ids";

describe("readIdList", () => {
  it("문자열 id 배열은 그대로 돌려준다", () => {
    expect(readIdList(["a", "b"], 10)).toEqual(["a", "b"]);
    expect(readIdList([], 10)).toEqual([]);
  });

  it("상한을 넘으면 거절한다", () => {
    expect(readIdList(["a", "b", "c"], 2)).toBeNull();
  });

  it("배열이 아니거나 문자열이 아닌 값이 섞이면 거절한다", () => {
    expect(readIdList("a,b", 10)).toBeNull();
    expect(readIdList(null, 10)).toBeNull();
    expect(readIdList(["a", 1], 10)).toBeNull();
    expect(readIdList(["a", { id: "b" }], 10)).toBeNull();
    expect(readIdList([""], 10)).toBeNull();
    expect(readIdList(["x".repeat(65)], 10)).toBeNull();
  });
});

describe("isId", () => {
  it("cuid 모양의 id는 받는다", () => {
    expect(isId("cm1abcdefghijklmnopqrstuv")).toBe(true);
  });

  it("문자열이 아니거나 비었거나 너무 길거나 기호가 섞이면 거절한다", () => {
    expect(isId(123)).toBe(false);
    expect(isId("")).toBe(false);
    expect(isId("a".repeat(65))).toBe(false);
    expect(isId("a b")).toBe(false);
    expect(isId("../x")).toBe(false);
  });
});
