import { describe, expect, it, vi } from "vitest";

import { parseKSTDate } from "@/lib/date";
import { hasRuleForm, readRuleForm } from "@/lib/routine-rule-form";

const START = parseKSTDate("2026-11-05");

function form(entries: Record<string, string | string[]>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) formData.append(key, item);
  }
  return formData;
}

describe("readRuleForm", () => {
  it("매일은 요일·날짜 없이 받고, 시작일 칸이 비면 기본 시작일을 쓴다", () => {
    expect(readRuleForm(form({ freq: "DAILY", byWeekday: ["1"], byMonthday: ["3"] }), START)).toEqual({
      freq: "DAILY",
      byWeekday: [],
      byMonthday: [],
      startDate: START,
      endDate: null,
    });
  });

  it("매주는 고른 요일만 받고 범위 밖 값은 버린다", () => {
    const rule = readRuleForm(form({ freq: "WEEKLY", byWeekday: ["1", "3", "7", "-1", "x"], byMonthday: ["15"] }), START);
    expect(rule).toMatchObject({ freq: "WEEKLY", byWeekday: [1, 3], byMonthday: [] });
  });

  it("매월은 고른 날짜만 받는다(0과 32는 버린다)", () => {
    const rule = readRuleForm(form({ freq: "MONTHLY", byMonthday: ["0", "1", "15", "31", "32"], byWeekday: ["2"] }), START);
    expect(rule).toMatchObject({ freq: "MONTHLY", byMonthday: [1, 15, 31], byWeekday: [] });
  });

  it("주기를 안 골랐거나 모르는 값이면 pickFreq", () => {
    expect(readRuleForm(form({}), START)).toBe("pickFreq");
    expect(readRuleForm(form({ freq: "YEARLY" }), START)).toBe("pickFreq");
  });

  it("매주인데 요일이 없거나 매월인데 날짜가 없으면 거른다", () => {
    expect(readRuleForm(form({ freq: "WEEKLY" }), START)).toBe("pickWeekday");
    expect(readRuleForm(form({ freq: "WEEKLY", byWeekday: ["9"] }), START)).toBe("pickWeekday");
    expect(readRuleForm(form({ freq: "MONTHLY" }), START)).toBe("pickMonthday");
  });

  it("시작일과 종료일을 읽고, 종료일이 시작일보다 앞서면 endBeforeStart", () => {
    expect(readRuleForm(form({ freq: "DAILY", startDate: "2026-12-01", endDate: "2026-12-31" }), START)).toMatchObject({
      startDate: parseKSTDate("2026-12-01"),
      endDate: parseKSTDate("2026-12-31"),
    });
    expect(readRuleForm(form({ freq: "DAILY", startDate: "2026-12-01", endDate: "2026-11-30" }), START)).toBe("endBeforeStart");
    // 시작일과 같은 날은 된다(하루짜리).
    expect(readRuleForm(form({ freq: "DAILY", startDate: "2026-12-01", endDate: "2026-12-01" }), START)).toMatchObject({
      endDate: parseKSTDate("2026-12-01"),
    });
  });

  it("종료일 칸이 비면 계속 반복이고, 날짜 모양이 틀리면 기본 시작일로 읽고 로그를 남긴다", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(readRuleForm(form({ freq: "DAILY", startDate: "2026-12-01", endDate: "" }), START)).toMatchObject({ endDate: null });
    expect(readRuleForm(form({ freq: "DAILY", startDate: "내일" }), START)).toMatchObject({ startDate: START });
    expect(error).toHaveBeenCalledOnce();

    error.mockRestore();
  });
});

describe("hasRuleForm", () => {
  it("주기 칸이 있어야 규칙 칸이 온 것으로 본다(옛 화면은 내용·카테고리만 보낸다)", () => {
    expect(hasRuleForm(form({ id: "a", content: "x", categoryId: "c" }))).toBe(false);
    expect(hasRuleForm(form({ id: "a", freq: "DAILY" }))).toBe(true);
  });
});
