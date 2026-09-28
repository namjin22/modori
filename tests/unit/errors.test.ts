import { describe, expect, it, vi } from "vitest";

// lib/errors.ts는 DB 클라이언트를 불러온다. 여기서는 거르는 함수만 보므로 연결하지 않는다.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { isClientAbort, safeMessage } from "@/lib/errors";

describe("isClientAbort", () => {
  it("사용자가 먼저 떠나 끊긴 연결은 오류로 치지 않는다", () => {
    expect(isClientAbort(new Error("The destination stream closed early."))).toBe(true);
    const aborted = new Error("aborted");
    aborted.name = "ResponseAborted";
    expect(isClientAbort(aborted)).toBe(true);
  });

  it("그 밖의 오류는 그대로 남긴다", () => {
    expect(isClientAbort(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isClientAbort(new TypeError("The destination stream closed early"))).toBe(false);
    expect(isClientAbort("The destination stream closed early.")).toBe(false);
  });
});

describe("safeMessage", () => {
  it("첫 줄만 남겨 Prisma 오류에 딸려 오는 사용자 입력을 버린다", () => {
    const prisma = 'Invalid `prisma.todo.create()` invocation:\n\n{\n  data: {\n    content: "남에게 보이면 안 되는 할 일"\n  }\n}';
    expect(safeMessage(prisma)).toBe("Invalid `prisma.todo.create()` invocation:");
  });

  it("300자로 자른다", () => {
    expect(safeMessage("x".repeat(500))).toHaveLength(300);
  });
});
