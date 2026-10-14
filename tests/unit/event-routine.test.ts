import { describe, expect, it } from "vitest";

import { formatKST } from "@/lib/date";
import { expandEventRoutines, type EventRoutineRule } from "@/lib/event-routine";

const day = (key: string) => new Date(`${key}T00:00:00Z`);

// 2026-10-12는 월요일.
const base: EventRoutineRule = {
  id: "r1",
  title: "학원",
  color: "#2563eb",
  startTime: 18 * 60,
  endTime: 19 * 60,
  freq: "WEEKLY",
  byWeekday: [1, 3],
  byMonthday: [],
  startDate: day("2026-10-01"),
  endDate: null,
  pausedAt: null,
};

const keys = (routines: EventRoutineRule[], skips: { eventRoutineId: string; date: Date }[] = [], from = "2026-10-12", to = "2026-10-18") =>
  expandEventRoutines(routines, skips, day(from), day(to)).map((event) => `${formatKST(event.startDate)} ${event.title}`);

describe("expandEventRoutines", () => {
  it("기간 안에서 규칙에 맞는 날마다 하루짜리 일정으로 펼친다", () => {
    expect(keys([base])).toEqual(["2026-10-12 학원", "2026-10-14 학원"]);
    const [first] = expandEventRoutines([base], [], day("2026-10-12"), day("2026-10-12"));
    expect(first).toMatchObject({
      id: "r1:2026-10-12",
      startTime: 18 * 60,
      endTime: 19 * 60,
      dday: false,
      repeat: { routineId: "r1", date: "2026-10-12", rule: "매주 월·수" },
    });
    expect(formatKST(first.endDate)).toBe("2026-10-12");
  });

  it("이 날만 뺀 날은 빠진다", () => {
    expect(keys([base], [{ eventRoutineId: "r1", date: day("2026-10-14") }])).toEqual(["2026-10-12 학원"]);
  });

  it("멈춘 반복 일정, 시작 전·종료 뒤의 날은 없다", () => {
    expect(keys([{ ...base, pausedAt: new Date() }])).toEqual([]);
    expect(keys([{ ...base, startDate: day("2026-10-13") }])).toEqual(["2026-10-14 학원"]);
    expect(keys([{ ...base, endDate: day("2026-10-13") }])).toEqual(["2026-10-12 학원"]);
  });

  it("매일·매월도 펼치고, 같은 날은 하루 종일이 먼저, 그다음 시각순이다", () => {
    const daily: EventRoutineRule = { ...base, id: "r2", title: "운동", freq: "DAILY", byWeekday: [], startTime: 7 * 60, endTime: null };
    const allDay: EventRoutineRule = { ...base, id: "r3", title: "용돈", freq: "MONTHLY", byWeekday: [], byMonthday: [12], startTime: null, endTime: null };
    expect(keys([base, daily, allDay], [], "2026-10-12", "2026-10-13")).toEqual([
      "2026-10-12 용돈",
      "2026-10-12 운동",
      "2026-10-12 학원",
      "2026-10-13 운동",
    ]);
  });
});
