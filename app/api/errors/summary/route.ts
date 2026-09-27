import { prisma } from "@/lib/prisma";

/**
 * 최근 오류 수. GitHub Actions(.github/workflows/errors.yml)가 매시간 부른다.
 * 저장소가 공개라 Actions 기록도 공개된다. 그래서 내용은 주지 않고 수만 준다.
 * 비밀 값(MONITOR_TOKEN)이 맞아야 답한다. 값이 설정되지 않은 서버는 이 주소가 없는 것처럼 군다.
 */
export async function GET(request: Request) {
  const token = process.env.MONITOR_TOKEN;
  if (!token || request.headers.get("x-monitor-token") !== token) {
    return new Response(null, { status: 404 });
  }

  const minutes = Math.min(Math.max(Number(new URL(request.url).searchParams.get("minutes")) || 65, 1), 1440);
  const count = await prisma.errorEvent.count({
    where: { createdAt: { gte: new Date(Date.now() - minutes * 60 * 1000) } },
  });
  return Response.json({ minutes, count });
}
