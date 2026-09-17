import { describe, expect, it } from "vitest";

import { formatMonthDayKST, parseKSTDate } from "@/lib/date";

describe("formatMonthDayKST", () => {
  it("앞자리 0 없이 월과 일을 적는다", () => {
    expect(formatMonthDayKST(parseKSTDate("2026-09-07"))).toBe("9월 7일");
    expect(formatMonthDayKST(parseKSTDate("2026-12-31"))).toBe("12월 31일");
  });

  it("한국 시각으로 자정을 넘긴 순간은 다음 날로 적는다", () => {
    // UTC 15:00 = 한국 00:00
    expect(formatMonthDayKST(new Date("2026-09-16T15:00:00Z"))).toBe("9월 17일");
    expect(formatMonthDayKST(new Date("2026-09-16T14:59:59Z"))).toBe("9월 16일");
  });
});
