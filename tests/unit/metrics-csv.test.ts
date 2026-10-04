import { describe, expect, it } from "vitest";

import { parseKSTDate } from "@/lib/date";
import { dailyStatsToCsv } from "@/lib/metrics-csv";

const base = {
  accounts: 21,
  users: 20,
  withTodo: 7,
  withFollow: 6,
  withReaction: 4,
  dau: 5,
  wau: 20,
  todosCreated: 18,
  follows: 9,
  reactionsCreated: 3,
  reactionsCharacter: 2,
  cohortSize: 1,
  cohortReturned: 1,
};

describe("하루 합계 CSV", () => {
  it("머리글과 날짜순 한 줄씩, 가입 경로는 JSON 한 칸으로 낸다", () => {
    const csv = dailyStatsToCsv([
      { ...base, date: parseKSTDate("2026-10-06"), sources: { discord: 12, direct: 8 } },
      { ...base, date: parseKSTDate("2026-10-07"), sources: null },
    ]);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe(
      "date,accounts,users,withTodo,withFollow,withReaction,dau,wau,todosCreated,follows,reactionsCreated,reactionsCharacter,cohortSize,cohortReturned,sourcesJson",
    );
    expect(lines[1]).toBe('2026-10-06,21,20,7,6,4,5,20,18,9,3,2,1,1,"{""discord"":12,""direct"":8}"');
    expect(lines[2]).toBe("2026-10-07,21,20,7,6,4,5,20,18,9,3,2,1,1,");
  });
});
