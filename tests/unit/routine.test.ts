import { describe, expect, it } from "vitest";

import { parseKSTDate } from "@/lib/date";
import { matchesRule, type RoutineRule } from "@/lib/routine";

function rule(overrides: Partial<RoutineRule> = {}): RoutineRule {
  return {
    freq: "DAILY",
    byWeekday: [],
    byMonthday: [],
    startDate: parseKSTDate("2026-01-01"),
    endDate: null,
    pausedAt: null,
    ...overrides,
  };
}

const 화요일 = parseKSTDate("2026-09-15");
const 일요일 = parseKSTDate("2026-09-13");

describe("공통 조건", () => {
  it("pausedAt이 설정되어 있으면 기간 안이어도 false", () => {
    expect(matchesRule(rule({ pausedAt: new Date() }), 화요일)).toBe(false);
  });

  it("startDate 이전은 false", () => {
    expect(
      matchesRule(rule({ startDate: parseKSTDate("2026-09-16") }), 화요일),
    ).toBe(false);
  });

  it("startDate 당일은 포함된다", () => {
    expect(
      matchesRule(rule({ startDate: parseKSTDate("2026-09-15") }), 화요일),
    ).toBe(true);
  });

  it("endDate 이후는 false", () => {
    expect(
      matchesRule(rule({ endDate: parseKSTDate("2026-09-14") }), 화요일),
    ).toBe(false);
  });

  it("endDate 당일은 포함된다", () => {
    expect(
      matchesRule(rule({ endDate: parseKSTDate("2026-09-15") }), 화요일),
    ).toBe(true);
  });
});

describe("DAILY", () => {
  it("공통 조건만 통과하면 true", () => {
    expect(matchesRule(rule({ freq: "DAILY" }), 화요일)).toBe(true);
    expect(matchesRule(rule({ freq: "DAILY" }), 일요일)).toBe(true);
  });
});

describe("WEEKLY", () => {
  it("byWeekday에 그 요일이 있으면 true", () => {
    expect(
      matchesRule(rule({ freq: "WEEKLY", byWeekday: [1, 3, 5] }), 화요일),
    ).toBe(false);
    expect(
      matchesRule(rule({ freq: "WEEKLY", byWeekday: [2, 4] }), 화요일),
    ).toBe(true);
  });

  it("일요일은 0으로 매칭된다", () => {
    expect(matchesRule(rule({ freq: "WEEKLY", byWeekday: [0] }), 일요일)).toBe(
      true,
    );
  });

  it("byWeekday가 빈 배열이면 어떤 날짜에도 false", () => {
    expect(matchesRule(rule({ freq: "WEEKLY", byWeekday: [] }), 화요일)).toBe(
      false,
    );
    expect(matchesRule(rule({ freq: "WEEKLY", byWeekday: [] }), 일요일)).toBe(
      false,
    );
  });
});

describe("MONTHLY", () => {
  it("byMonthday에 그 날짜가 있으면 true", () => {
    expect(
      matchesRule(rule({ freq: "MONTHLY", byMonthday: [15] }), 화요일),
    ).toBe(true);
    expect(
      matchesRule(rule({ freq: "MONTHLY", byMonthday: [14, 16] }), 화요일),
    ).toBe(false);
  });

  it("byMonthday가 빈 배열이면 어떤 날짜에도 false", () => {
    expect(matchesRule(rule({ freq: "MONTHLY", byMonthday: [] }), 화요일)).toBe(
      false,
    );
  });

  it("31일 루틴은 31일이 없는 달에 생성하지 않는다 (말일로 당기지 않는다)", () => {
    const 매월31일 = rule({ freq: "MONTHLY", byMonthday: [31] });

    expect(matchesRule(매월31일, parseKSTDate("2026-01-31"))).toBe(true);
    expect(matchesRule(매월31일, parseKSTDate("2026-02-28"))).toBe(false);
    expect(matchesRule(매월31일, parseKSTDate("2026-04-30"))).toBe(false);
    expect(matchesRule(매월31일, parseKSTDate("2028-02-29"))).toBe(false);
  });
});

describe("KST 경계", () => {
  it("KST 밤 11시(UTC로는 다음 날)에도 그 날의 요일로 판정한다", () => {
    const 화요일밤11시 = new Date("2026-09-15T14:00:00Z");
    expect(
      matchesRule(rule({ freq: "WEEKLY", byWeekday: [2] }), 화요일밤11시),
    ).toBe(true);
  });

  it("KST 새벽 0시 30분(UTC로는 전날)에도 그 날로 판정한다", () => {
    const 화요일새벽 = new Date("2026-09-15T00:30:00+09:00");
    expect(
      matchesRule(rule({ freq: "MONTHLY", byMonthday: [15] }), 화요일새벽),
    ).toBe(true);
  });
});
