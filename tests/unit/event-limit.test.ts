import { describe, expect, it } from "vitest";

import { parseKSTDate } from "@/lib/date";
import { firstOverfullDay } from "@/lib/event-limit";

const day = (value: string) => parseKSTDate(value);
const range = (start: string, end = start) => ({ startDate: day(start), endDate: day(end) });

describe("firstOverfullDay", () => {
  it("그날 일정이 상한보다 적으면 넣을 수 있다", () => {
    const existing = [range("2026-10-01"), range("2026-10-01"), range("2026-09-30", "2026-10-02")];
    expect(firstOverfullDay(existing, day("2026-10-01"), day("2026-10-01"), 5)).toBeNull();
  });

  it("그날 이미 상한만큼 있으면 그날을 돌려준다", () => {
    const existing = Array.from({ length: 5 }, () => range("2026-10-01"));
    expect(firstOverfullDay(existing, day("2026-10-01"), day("2026-10-01"), 5)).toEqual(day("2026-10-01"));
  });

  it("여러 날 일정은 기간 안의 날마다 세서 처음 꽉 찬 날을 알려준다", () => {
    // 10/3에만 여러 날 일정 둘과 하루 일정 셋이 겹친다.
    const existing = [
      range("2026-10-01", "2026-10-03"),
      range("2026-10-03", "2026-10-05"),
      range("2026-10-03"),
      range("2026-10-03"),
      range("2026-10-03"),
    ];
    expect(firstOverfullDay(existing, day("2026-10-01"), day("2026-10-02"), 5)).toBeNull();
    expect(firstOverfullDay(existing, day("2026-10-02"), day("2026-10-04"), 5)).toEqual(day("2026-10-03"));
  });
});
