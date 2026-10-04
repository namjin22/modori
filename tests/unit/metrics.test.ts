import { describe, expect, it } from "vitest";

import { parseKSTDate } from "@/lib/date";
import { groupByWeek, percent, type DailyRow } from "@/lib/metrics";

function row(date: string, values: Partial<DailyRow> = {}): DailyRow {
  return {
    date: parseKSTDate(date),
    users: 0,
    wau: 0,
    todosCreated: 0,
    reactionsCreated: 0,
    reactionsCharacter: 0,
    cohortSize: 0,
    cohortReturned: 0,
    ...values,
  };
}

describe("groupByWeek", () => {
  it("일요일부터 토요일까지를 한 주로 묶고, 누적 값은 그 주 마지막 날 것을 쓴다", () => {
    // 2026-09-27은 일요일, 2026-10-03은 토요일.
    const weeks = groupByWeek([
      row("2026-10-03", { users: 12, wau: 9, todosCreated: 5 }),
      row("2026-09-27", { users: 10, wau: 4, todosCreated: 3, cohortSize: 2, cohortReturned: 1 }),
      row("2026-09-30", { users: 11, wau: 7, reactionsCreated: 2, cohortSize: 1, cohortReturned: 1 }),
    ]);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({
      users: 12,
      wau: 9,
      signups: null,
      todosCreated: 8,
      reactionsCreated: 2,
      cohortSize: 3,
      cohortReturned: 2,
    });
  });

  it("캐릭터 반응도 주마다 더한다", () => {
    const weeks = groupByWeek([
      row("2026-09-28", { reactionsCreated: 3, reactionsCharacter: 2 }),
      row("2026-09-29", { reactionsCreated: 4, reactionsCharacter: 1 }),
    ]);
    expect(weeks[0]).toMatchObject({ reactionsCreated: 7, reactionsCharacter: 3 });
  });

  it("가입 수는 앞 주 마지막 누적과의 차이다", () => {
    const weeks = groupByWeek([
      row("2026-09-26", { users: 5 }),
      row("2026-09-28", { users: 9 }),
      row("2026-10-05", { users: 8 }),
    ]);
    expect(weeks.map((week) => week.signups)).toEqual([null, 4, -1]);
  });
});

describe("percent", () => {
  it("분모가 0이면 셀 수 없다", () => {
    expect(percent(0, 0)).toBeNull();
  });

  it("반올림한 정수", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
  });
});
