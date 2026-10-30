// 화면 언어별 날짜·시각 글자(lib/i18n/format.ts)
import { describe, expect, it } from "vitest";

import { clock, dayHeading, formatMonthDay, fullDate, fullDateWithWeekday, monthDay, monthDayWithWeekday, monthName, weekdayName, yearMonth } from "@/lib/i18n/format";

describe("날짜 글자", () => {
  it("짧은 날짜", () => {
    expect(monthDay("ko", 10, 30)).toBe("10월 30일");
    expect(monthDay("en", 10, 30)).toBe("Oct 30");
    expect(monthDay("ja", 10, 30)).toBe("10月30日");
  });

  it("년을 붙인 날짜와 요일", () => {
    expect(fullDate("ko", 2026, 10, 2)).toBe("2026년 10월 2일");
    expect(fullDate("en", 2026, 10, 2)).toBe("Oct 2, 2026");
    expect(fullDateWithWeekday("ja", 2026, 10, 2, 5)).toBe("2026年10月2日 (金)");
    expect(monthDayWithWeekday("en", 10, 30, 5)).toBe("Oct 30 (Fri)");
  });

  it("날짜 제목", () => {
    expect(dayHeading("ko", 10, 30, 5)).toBe("10월 30일 금요일");
    expect(dayHeading("en", 10, 30, 5)).toBe("Friday, Oct 30");
    expect(dayHeading("ja", 10, 30, 5)).toBe("10月30日 金曜日");
  });

  it("년과 달, 달 이름, 요일", () => {
    expect(yearMonth("ko", 2026, 10)).toBe("2026년 10월");
    expect(yearMonth("en", 2026, 10)).toBe("October 2026");
    expect(yearMonth("ja", 2026, 1)).toBe("2026年1月");
    expect(monthName("en", 12)).toBe("Dec");
    expect(weekdayName("ko", 0)).toBe("일");
    expect(weekdayName("en", 6, "long")).toBe("Saturday");
  });

  it("날짜 값에서 짧은 날짜를 만든다", () => {
    expect(formatMonthDay("en", new Date("2026-10-30T00:00:00Z"))).toBe("Oct 30");
  });
});

describe("시각 글자", () => {
  it("12시간제로 적는다", () => {
    expect(clock("ko", 6 * 60)).toBe("오전 6:00");
    expect(clock("en", 6 * 60)).toBe("6:00 AM");
    expect(clock("ja", 18 * 60 + 5)).toBe("午後6:05");
    expect(clock("en", 0)).toBe("12:00 AM");
    expect(clock("en", 12 * 60)).toBe("12:00 PM");
  });
});
