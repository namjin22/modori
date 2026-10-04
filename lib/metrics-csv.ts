import { formatKST } from "@/lib/date";

export type CsvStat = {
  date: Date;
  accounts: number;
  users: number;
  withTodo: number;
  withFollow: number;
  withReaction: number;
  dau: number;
  wau: number;
  todosCreated: number;
  follows: number;
  reactionsCreated: number;
  reactionsCharacter: number;
  cohortSize: number;
  cohortReturned: number;
  sources: unknown;
};

const COLUMNS = [
  "date",
  "accounts",
  "users",
  "withTodo",
  "withFollow",
  "withReaction",
  "dau",
  "wau",
  "todosCreated",
  "follows",
  "reactionsCreated",
  "reactionsCharacter",
  "cohortSize",
  "cohortReturned",
  "sourcesJson",
] as const;

/** 쉼표·따옴표·줄바꿈이 든 칸은 따옴표로 감싸고 안의 따옴표는 두 번 적는다. */
function cell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * 하루 합계(DailyStat)를 CSV로. 엑셀·구글 시트에서 그래프를 그리려고 운영자만 내려받는다(docs/metrics.md).
 * 사람을 알아볼 수 있는 값은 없고 날짜별 숫자와 가입 경로별 누적(JSON)뿐이다.
 */
export function dailyStatsToCsv(rows: CsvStat[]): string {
  const lines = [COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        formatKST(row.date),
        row.accounts,
        row.users,
        row.withTodo,
        row.withFollow,
        row.withReaction,
        row.dau,
        row.wau,
        row.todosCreated,
        row.follows,
        row.reactionsCreated,
        row.reactionsCharacter,
        row.cohortSize,
        row.cohortReturned,
        row.sources === null || row.sources === undefined ? "" : JSON.stringify(row.sources),
      ]
        .map(cell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
