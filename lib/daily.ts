import { addDays, formatKST, todayKST } from "@/lib/date";
import { snapshotIfMissing } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

// 서버가 하나라 메모리로 하루 한 번을 센다. 재시작하면 한 번 더 돌지만 둘 다 이미 된 일은 건너뛴다.
let doneFor: string | null = null;

/**
 * 하루 한 번 하는 정리: 전날 지표 합계 찍기, 만료된 로그인 세션 지우기.
 * 로그인한 요청(requireUser)과 /api/health가 부른다. 이틀 내리 아무도 안 와도 GitHub `health` 감시가
 * 몇 시간마다 health를 불러 합계가 빠지지 않는다.
 */
export async function runDailyOnce(): Promise<void> {
  const today = todayKST();
  const key = formatKST(today);
  if (doneFor === key) return;
  // 기다리는 동안 들어온 요청이 같은 일을 또 시작하지 않게 먼저 적는다.
  doneFor = key;
  await snapshotIfMissing(addDays(today, -1));
  await deleteExpiredSessions();
}

/**
 * Auth.js는 만료된 세션을 그 쿠키로 다시 들어올 때만 지운다. 다시 오지 않는 사람의 행은 계속 남아서 여기서 지운다.
 * 만료된 세션으로는 어차피 로그인되지 않으므로 지워도 사용자에게 달라지는 것이 없다.
 */
async function deleteExpiredSessions() {
  try {
    const { count } = await prisma.session.deleteMany({ where: { expires: { lt: new Date() } } });
    if (count > 0) console.info(`[daily] 만료된 세션 ${count}개를 지웠다.`);
  } catch (error) {
    console.error("[daily] 만료된 세션을 지우지 못했다.", error);
  }
}
