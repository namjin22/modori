import { describe, expect, it } from "vitest";

import {
  addMonths,
  daysInMonthKST,
  endOfMonthKST,
  formatKST,
  formatMonthKST,
  parseKSTDate,
  parseKSTMonth,
  startOfMonthKST,
} from "@/lib/date";

describe("formatMonthKST", () => {
  it("YYYY-MM으로 만든다", () => {
    expect(formatMonthKST(parseKSTDate("2026-09-15"))).toBe("2026-09");
  });

  it("KST 밤 11시는 그 달이다", () => {
    expect(formatMonthKST(new Date("2026-09-30T14:00:00Z"))).toBe("2026-09");
  });
});

describe("parseKSTMonth", () => {
  it("그 달 1일을 준다", () => {
    expect(formatKST(parseKSTMonth("2026-09"))).toBe("2026-09-01");
  });

  it("두 자리로 맞추지 않으면 throw", () => {
    expect(() => parseKSTMonth("2026-9")).toThrow();
  });

  it("존재하지 않는 달은 throw", () => {
    expect(() => parseKSTMonth("2026-13")).toThrow();
  });
});

describe("startOfMonthKST / endOfMonthKST", () => {
  it("달의 처음과 끝을 준다", () => {
    const day = parseKSTDate("2026-09-15");
    expect(formatKST(startOfMonthKST(day))).toBe("2026-09-01");
    expect(formatKST(endOfMonthKST(day))).toBe("2026-09-30");
  });

  it("31일까지 있는 달", () => {
    expect(formatKST(endOfMonthKST(parseKSTDate("2026-01-10")))).toBe(
      "2026-01-31",
    );
  });

  it("평년 2월", () => {
    expect(formatKST(endOfMonthKST(parseKSTDate("2026-02-10")))).toBe(
      "2026-02-28",
    );
  });

  it("윤년 2월", () => {
    expect(formatKST(endOfMonthKST(parseKSTDate("2028-02-10")))).toBe(
      "2028-02-29",
    );
  });
});

describe("addMonths", () => {
  it("해를 넘긴다", () => {
    expect(formatKST(addMonths(parseKSTDate("2026-12-05"), 1))).toBe(
      "2027-01-01",
    );
  });

  it("음수로 되돌린다", () => {
    expect(formatKST(addMonths(parseKSTDate("2027-01-05"), -1))).toBe(
      "2026-12-01",
    );
  });

  it("31일에서 다음 달로 가도 날짜가 튀지 않는다", () => {
    // 1일로 맞춘 뒤 옮기므로 3월로 밀리는 일이 없다
    expect(formatKST(addMonths(parseKSTDate("2026-01-31"), 1))).toBe(
      "2026-02-01",
    );
  });

  it("인자로 받은 Date를 바꾸지 않는다", () => {
    const original = parseKSTDate("2026-09-15");
    const before = original.getTime();
    addMonths(original, 3);
    expect(original.getTime()).toBe(before);
  });
});

describe("daysInMonthKST", () => {
  it("달마다 일수가 맞다", () => {
    expect(daysInMonthKST(parseKSTDate("2026-09-01"))).toBe(30);
    expect(daysInMonthKST(parseKSTDate("2026-01-01"))).toBe(31);
    expect(daysInMonthKST(parseKSTDate("2026-02-01"))).toBe(28);
    expect(daysInMonthKST(parseKSTDate("2028-02-01"))).toBe(29);
  });
});
