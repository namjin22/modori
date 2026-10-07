import { isAdmin } from "@/lib/admin";
import { loadUserRows, sortRows } from "@/lib/admin-users";
import { usersToCsv } from "@/lib/admin-users-csv";
import { formatKST, todayKST } from "@/lib/date";
import { getCurrentUser } from "@/lib/session";

/** 사용자별 이용 현황 CSV(누구인지 알 수 있는 칸 없음). 운영자만, 아니면 404. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAdmin(user.id))) return new Response(null, { status: 404 });

  const rows = sortRows(await loadUserRows(""), "joined").reverse();
  return new Response(`﻿${usersToCsv(rows)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="modori-users-${formatKST(todayKST())}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
