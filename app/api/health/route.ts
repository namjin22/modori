import { NextResponse } from "next/server";

import { runDailyOnce } from "@/lib/daily";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    // 사람이 오지 않는 날에도 하루 정리가 돌게 한다(lib/daily.ts). 하루 한 번만 실제로 일한다.
    await runDailyOnce();
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[health] database check failed", error);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
