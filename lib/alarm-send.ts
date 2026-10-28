import { alarmDay, alarmPush } from "@/lib/alarm";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";

/**
 * 때가 된 "내가 정한 알림"을 보낸다(lib/alarm.ts). 보낸 알림 수를 돌려준다.
 * 같은 알림이 두 번 가지 않게, 보내기 전에 "보낸 날"을 조건부로 먼저 적는다(서버가 둘 떠 있어도 하나만 성공한다).
 * 알림을 받을 기기(앱 푸시 번호나 웹 푸시 구독)가 없는 사람은 보낼 곳이 없어 건너뛴다. 내가 정한 알림은 앱과 켠 컴퓨터 모두에 간다.
 */
export async function sendDueAlarms(now: Date = new Date()): Promise<number> {
  const alarms = await prisma.alarm.findMany({
    where: {
      enabled: true,
      user: { nickname: { not: null }, OR: [{ pushTokens: { some: {} } }, { webPushSubscriptions: { some: {} } }] },
    },
    select: { id: true, minute: true, weekdays: true, message: true, lastSentOn: true, user: { select: { id: true, timezone: true } } },
  });

  let sent = 0;
  for (const alarm of alarms) {
    const day = alarmDay(alarm, alarm.user.timezone, now);
    if (!day) continue;
    const claimed = await prisma.alarm.updateMany({
      where: { id: alarm.id, enabled: true, minute: alarm.minute, OR: [{ lastSentOn: null }, { lastSentOn: { not: day } }] },
      data: { lastSentOn: day },
    });
    if (claimed.count === 0) continue;
    await sendPushToUser(alarm.user.id, alarmPush(alarm));
    sent += 1;
  }
  return sent;
}

const LOOP_MS = 60 * 1000;

// 개발 서버는 파일을 고칠 때마다 모듈을 다시 읽는다. 반복을 전역에 하나만 걸어 겹치지 않게 한다.
const loop = globalThis as typeof globalThis & { modoriAlarmLoop?: ReturnType<typeof setInterval> };

/** 서버가 켜질 때 한 번 부른다(instrumentation.ts). 외부 예약 서비스나 VM 예약 작업 없이 앱 서버 하나로 돈다. */
export function startAlarmLoop() {
  if (loop.modoriAlarmLoop) return;
  loop.modoriAlarmLoop = setInterval(() => {
    sendDueAlarms().catch((error) => console.error("[alarm] 내가 정한 알림을 보내지 못했다.", error));
  }, LOOP_MS);
}
