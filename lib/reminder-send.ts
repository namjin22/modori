import { sendDueAlarms } from "@/lib/alarm-send";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { reminderDay, reminderMessage } from "@/lib/reminder";
import { ensureRoutineTodos } from "@/lib/routine-todos";

const LOOP_MS = 60 * 1000;

/**
 * 지금 리마인드를 보낼 차례인 사람에게 보낸다(lib/reminder.ts). 보낸 사람 수를 돌려준다.
 * 같은 사람에게 두 번 가지 않게, 보내기 전에 "보낸 날"을 조건부로 먼저 적는다(서버가 둘 떠 있어도 하나만 성공한다).
 */
export async function sendDueReminders(now: Date = new Date()): Promise<number> {
  const candidates = await prisma.user.findMany({
    // 알림을 받을 기기가 없으면 보낼 곳이 없다.
    where: { reminderMinute: { not: null }, nickname: { not: null }, pushTokens: { some: {} } },
    select: { id: true, createdAt: true, timezone: true, reminderMinute: true, reminderSentOn: true },
  });

  let sent = 0;
  for (const owner of candidates) {
    const day = reminderDay(owner, now);
    if (!day) continue;
    const claimed = await prisma.user.updateMany({
      where: { id: owner.id, reminderMinute: owner.reminderMinute, OR: [{ reminderSentOn: null }, { reminderSentOn: { not: day } }] },
      data: { reminderSentOn: day },
    });
    if (claimed.count === 0) continue;

    // 오늘 화면을 아직 안 열었으면 오늘의 루틴 할 일이 아직 없다. 화면을 여는 것과 같이 먼저 만든 뒤 센다.
    await ensureRoutineTodos(owner, day);
    const left = await prisma.todo.count({ where: { userId: owner.id, date: day, done: false } });
    if (left === 0) continue;
    // 리마인드는 앱 푸시로만(웹 푸시로 보내지 않는다, CLAUDE.md 규칙 7).
    await sendPushToUser(owner.id, reminderMessage(left), { web: false });
    sent += 1;
  }
  return sent;
}

// 개발 서버는 파일을 고칠 때마다 모듈을 다시 읽는다. 반복을 전역에 하나만 걸어 겹치지 않게 한다.
const loop = globalThis as typeof globalThis & { modoriReminderLoop?: ReturnType<typeof setInterval> };

/** 서버가 켜질 때 한 번 부른다(instrumentation.ts). */
export function startReminderLoop() {
  if (loop.modoriReminderLoop) return;
  loop.modoriReminderLoop = setInterval(() => {
    sendDueReminders().catch((error) => console.error("[reminder] 리마인드를 보내지 못했다.", error));
    // 내가 정한 알림(lib/alarm-send.ts)도 같은 반복에서 보낸다. 하나가 실패해도 다른 하나는 간다.
    sendDueAlarms().catch((error) => console.error("[alarm] 내가 정한 알림을 보내지 못했다.", error));
  }, LOOP_MS);
}
