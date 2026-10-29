import { eventDigestDay, eventDigestPush, type EventDigestItem } from "@/lib/event-digest";
import { expandEventRoutines } from "@/lib/event-routine";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";

/** 그 날 걸친 일정(보통 일정, 이어서 반복 일정). 홈 화면의 일정 목록과 같은 순서라 알림의 첫 일정이 화면 맨 위와 같다. */
async function eventsOn(userId: string, day: Date): Promise<EventDigestItem[]> {
  const [events, routines, skips] = await Promise.all([
    prisma.event.findMany({
      where: { userId, startDate: { lte: day }, endDate: { gte: day } },
      orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }, { startTime: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      select: { title: true, startDate: true, startTime: true },
    }),
    prisma.eventRoutine.findMany({
      where: { userId, startDate: { lte: day }, OR: [{ endDate: null }, { endDate: { gte: day } }] },
    }),
    prisma.eventRoutineSkip.findMany({
      where: { date: day, eventRoutine: { userId } },
      select: { eventRoutineId: true, date: true },
    }),
  ]);
  return [...events, ...expandEventRoutines(routines, skips, day, day)];
}

/**
 * 지금 오늘 일정 알림을 보낼 차례인 사람에게 보낸다(lib/event-digest.ts). 보낸 사람 수를 돌려준다.
 * 같은 사람에게 두 번 가지 않게, 보내기 전에 "보낸 날"을 조건부로 먼저 적는다(서버가 둘 떠 있어도 하나만 성공한다).
 * 일정이 없는 날도 보낸 날은 적는다(창 안에서 1분마다 일정을 다시 찾지 않으려고).
 */
export async function sendDueEventDigests(now: Date = new Date()): Promise<number> {
  const candidates = await prisma.user.findMany({
    // 알림을 받을 기기가 없으면 보낼 곳이 없다.
    where: { eventDigestMinute: { not: null }, nickname: { not: null }, pushTokens: { some: {} } },
    select: { id: true, timezone: true, eventDigestMinute: true, eventDigestSentOn: true },
  });

  let sent = 0;
  for (const owner of candidates) {
    const day = eventDigestDay(owner, now);
    if (!day) continue;
    const claimed = await prisma.user.updateMany({
      where: {
        id: owner.id,
        eventDigestMinute: owner.eventDigestMinute,
        OR: [{ eventDigestSentOn: null }, { eventDigestSentOn: { not: day } }],
      },
      data: { eventDigestSentOn: day },
    });
    if (claimed.count === 0) continue;

    const message = eventDigestPush(await eventsOn(owner.id, day), day);
    if (!message) continue;
    // 오늘 일정 알림은 앱 푸시로만(웹 푸시로 보내지 않는다, CLAUDE.md 규칙 7).
    await sendPushToUser(owner.id, message, { web: false });
    sent += 1;
  }
  return sent;
}
