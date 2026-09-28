import { describe, expect, it } from "vitest";

import { parseKSTDate } from "@/lib/date";
import { describeEventWhen, formatTime, parseTime } from "@/lib/event-time";

describe("parseTime", () => {
  it("HH:MM을 자정부터의 분으로 바꾼다", () => {
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("09:30")).toBe(570);
    expect(parseTime("23:59")).toBe(1439);
  });

  it("비었으면 null, 틀리면 undefined", () => {
    expect(parseTime("")).toBeNull();
    expect(parseTime("24:00")).toBeUndefined();
    expect(parseTime("9:30")).toBeUndefined();
    expect(parseTime("09:60")).toBeUndefined();
  });
});

describe("formatTime", () => {
  it("분을 두 자리 시:분으로", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(570)).toBe("09:30");
    expect(formatTime(1439)).toBe("23:59");
  });
});

describe("describeEventWhen", () => {
  const day = (value: string) => parseKSTDate(value);

  it("하루 종일인 하루짜리 일정은 적을 게 없다", () => {
    expect(
      describeEventWhen({ startDate: day("2026-10-01"), endDate: day("2026-10-01"), startTime: null, endTime: null }),
    ).toBeNull();
  });

  it("하루짜리는 시각만", () => {
    const base = { startDate: day("2026-10-01"), endDate: day("2026-10-01") };
    expect(describeEventWhen({ ...base, startTime: 540, endTime: null })).toBe("09:00");
    expect(describeEventWhen({ ...base, startTime: 540, endTime: 630 })).toBe("09:00 ~ 10:30");
  });

  it("여러 날은 날짜에 시각을 붙인다", () => {
    const base = { startDate: day("2026-09-28"), endDate: day("2026-09-30") };
    expect(describeEventWhen({ ...base, startTime: null, endTime: null })).toBe("9월 28일 ~ 9월 30일");
    expect(describeEventWhen({ ...base, startTime: 540, endTime: 1080 })).toBe("9월 28일 09:00 ~ 9월 30일 18:00");
  });
});
