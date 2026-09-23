import { describe, expect, it } from "vitest";

import { parseKSTDate } from "@/lib/date";
import {
  countByCategory,
  countByWeekday,
  streakDays,
  type StatTodo,
} from "@/lib/stats";

const 공부 = { id: "c1", name: "공부", color: "#8b5cf6" };
const 운동 = { id: "c2", name: "운동", color: "#00b26a" };

function todo(date: string, done: boolean, category = 공부): StatTodo {
  return { date: parseKSTDate(date), done, category };
}

describe("countByCategory", () => {
  it("카테고리마다 적은 수와 끝낸 수를 센다", () => {
    const stats = countByCategory([
      todo("2026-09-01", true),
      todo("2026-09-02", false),
      todo("2026-09-03", true, 운동),
    ]);

    expect(stats).toEqual([
      { id: "c1", name: "공부", color: "#8b5cf6", total: 2, done: 1 },
      { id: "c2", name: "운동", color: "#00b26a", total: 1, done: 1 },
    ]);
  });

  it("많이 적은 카테고리가 위로 온다", () => {
    const stats = countByCategory([
      todo("2026-09-01", false, 운동),
      todo("2026-09-02", false),
      todo("2026-09-03", false),
    ]);

    expect(stats.map((s) => s.name)).toEqual(["공부", "운동"]);
  });

  it("카테고리 없는 할 일도 한 묶음으로 센다", () => {
    const stats = countByCategory([
      { date: parseKSTDate("2026-09-01"), done: true, category: null },
    ]);

    expect(stats).toEqual([
      { id: "", name: "카테고리 없음", color: null, total: 1, done: 1 },
    ]);
  });
});

describe("countByWeekday", () => {
  it("끝낸 것만 요일별로 센다", () => {
    // 2026-09-06은 일요일, 2026-09-07은 월요일이다.
    const counts = countByWeekday([
      todo("2026-09-06", true),
      todo("2026-09-07", true),
      todo("2026-09-07", true),
      todo("2026-09-07", false),
    ]);

    expect(counts).toEqual([1, 2, 0, 0, 0, 0, 0]);
  });
});

describe("streakDays", () => {
  const today = parseKSTDate("2026-09-22");

  it("오늘부터 이어진 날을 센다", () => {
    const count = streakDays(
      [
        todo("2026-09-22", true),
        todo("2026-09-21", true),
        todo("2026-09-20", true),
      ],
      today,
    );

    expect(count).toBe(3);
  });

  it("오늘이 아직 비어 있으면 어제부터 센다", () => {
    const count = streakDays(
      [todo("2026-09-21", true), todo("2026-09-20", true)],
      today,
    );

    expect(count).toBe(2);
  });

  it("하루라도 비면 거기서 끊는다", () => {
    const count = streakDays(
      [
        todo("2026-09-22", true),
        // 21일은 비어 있다.
        todo("2026-09-20", true),
      ],
      today,
    );

    expect(count).toBe(1);
  });

  it("끝내지 않은 날은 세지 않는다", () => {
    expect(streakDays([todo("2026-09-22", false)], today)).toBe(0);
  });

  it("아무것도 없으면 0이다", () => {
    expect(streakDays([], today)).toBe(0);
  });
});
