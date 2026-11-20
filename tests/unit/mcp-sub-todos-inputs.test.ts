import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createTodosInput } from "@/lib/mcp/inputs";

// create_todos의 세부 할 일 칸(parentId, 2026-11-20): 날짜는 큰 할 일을 달 때만 생략할 수 있다.
const schema = z.object(createTodosInput);
const parse = (todo: unknown) => schema.safeParse({ todos: [todo] });

describe("createTodosInput의 parentId", () => {
  it("날짜만 있거나 parentId만 있으면 받는다", () => {
    expect(parse({ content: "수학", date: "2026-11-20" }).success).toBe(true);
    expect(parse({ content: "세부", parentId: "abc123" }).success).toBe(true);
    expect(parse({ content: "세부", parentId: "abc123", date: "2026-11-20" }).success).toBe(true);
  });

  it("날짜도 parentId도 없으면 거절한다", () => {
    expect(parse({ content: "날짜 없음" }).success).toBe(false);
  });

  it("parentId는 id 모양만 받는다", () => {
    for (const parentId of ["", "a b", "../x", "가나다", "x".repeat(65)]) {
      expect(parse({ content: "세부", parentId }).success, parentId).toBe(false);
    }
  });

  it("날짜가 있으면 YYYY-MM-DD 모양이어야 한다", () => {
    expect(parse({ content: "세부", parentId: "abc123", date: "내일" }).success).toBe(false);
  });
});
