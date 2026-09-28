import { addDays, formatKST, todayKST } from "@/lib/date";
import { ensureSnapshots } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

// 세션 정리는 하루에 한 번, 합계 복구는 별도 작업으로 매 요청에서 누락분을 확인한다.
let doneFor: string | null = null;
let cleanupInFlight: Promise<void> | null = null;

/** 로그인한 요청과 /api/health가 부른다. 합계 복구는 응답을 기다리게 하지 않는다. */
export async function runDailyOnce(): Promise<void> {
  const today = todayKST();
  ensureSnapshots(addDays(today, -1));
  const key = formatKST(today);
  if (doneFor === key) return;
  if (!cleanupInFlight) {
    cleanupInFlight = deleteExpiredSessions().then((success) => {
      if (success) doneFor = key;
    }).finally(() => { cleanupInFlight = null; });
  }
  await cleanupInFlight;
}

/**
 * Auth.js는 만료된 세션을 그 쿠키로 다시 들어올 때만 지운다. 다시 오지 않는 사람의 행은 계속 남아서 여기서 지운다.
 * 만료된 세션으로는 어차피 로그인되지 않으므로 지워도 사용자에게 달라지는 것이 없다.
 */
async function deleteExpiredSessions(): Promise<boolean> {
  try {
    const { count } = await prisma.session.deleteMany({ where: { expires: { lt: new Date() } } });
    if (count > 0) console.info(`[daily] 만료된 세션 ${count}개를 지웠다.`);
    return true;
  } catch (error) {
    console.error("[daily] 만료된 세션을 지우지 못했다.", error);
    return false;
  }
}
