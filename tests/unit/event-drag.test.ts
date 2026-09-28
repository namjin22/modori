import { describe, expect, it } from "vitest";

import { dragRange } from "@/lib/event-drag";

describe("dragRange", () => {
  it("하루짜리 일정을 뒤로 끌면 종료일이 늘어난다", () => {
    expect(dragRange("2026-09-28", "2026-09-28", "2026-09-30")).toEqual({ start: "2026-09-28", end: "2026-09-30" });
  });

  it("시작일보다 앞으로 끌면 시작일을 당긴다", () => {
    expect(dragRange("2026-09-28", "2026-09-30", "2026-09-25")).toEqual({ start: "2026-09-25", end: "2026-09-30" });
  });

  it("기간 안에 놓으면 그날까지로 줄어든다", () => {
    expect(dragRange("2026-09-28", "2026-10-02", "2026-09-29")).toEqual({ start: "2026-09-28", end: "2026-09-29" });
  });

  it("달이 바뀌어도 날짜 순서대로 본다", () => {
    expect(dragRange("2026-09-30", "2026-09-30", "2026-10-01")).toEqual({ start: "2026-09-30", end: "2026-10-01" });
  });
});
