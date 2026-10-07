import { formatKST } from "@/lib/date";
import type { UserRow } from "@/lib/admin-users";

const COLUMNS = [
  "joined",
  "source",
  "providers",
  "profile",
  "character",
  "hideFromRecommend",
  "lastActive",
  "activeDays90",
  "todos",
  "todosDone",
  "categories",
  "routines",
  "events",
  "following",
  "followers",
  "reactionsSent",
  "reactionsReceived",
  "pushDevices",
] as const;

/**
 * 사용자별 이용 현황 CSV. 포트폴리오 그래프용이라 닉네임·이메일·id 같이 누구인지 알 수 있는 칸은 넣지 않는다.
 * (화면에서는 운영자가 닉네임·이메일을 본다.)
 */
export function usersToCsv(rows: UserRow[]): string {
  const lines = [COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        formatKST(row.createdAt),
        row.source,
        row.providers.join("+"),
        row.profile,
        row.character,
        row.hideFromRecommend ? 1 : 0,
        row.lastActive ? formatKST(row.lastActive) : "",
        row.activeDays,
        row.todos,
        row.todosDone,
        row.categories,
        row.routines,
        row.events,
        row.following,
        row.followers,
        row.reactionsSent,
        row.reactionsReceived,
        row.pushDevices,
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
