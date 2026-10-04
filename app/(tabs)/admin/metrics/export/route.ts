import { isAdmin } from "@/lib/admin";
import { formatKST, todayKST } from "@/lib/date";
import { dailyStatsToCsv } from "@/lib/metrics-csv";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * 하루 합계를 CSV로 내려받는다. 운영자만. 아니면 없는 주소처럼 404(지표 화면과 같다).
 * 포트폴리오 그래프용이라 전체 기간을 준다.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAdmin(user.id))) return new Response(null, { status: 404 });

  const rows = await prisma.dailyStat.findMany({ orderBy: { date: "asc" } });
  // 엑셀이 한글·UTF-8을 바로 알아보게 BOM을 붙인다.
  const body = `﻿${dailyStatsToCsv(rows)}`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="modori-daily-${formatKST(todayKST())}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
