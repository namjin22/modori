import { addDays, formatKST, todayKST } from "@/lib/date";
import { backfillStatColumns, cleanExpiredActiveDays, ensureSnapshots } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

// 서버가 하나라 메모리로 하루 한 번을 센다. 재시작하면 한 번 더 돌지만 이미 된 일은 건너뛴다.
type DailyTask = { doneFor: string | null; running: Promise<boolean> | null };
const sessionCleanup: DailyTask = { doneFor: null, running: null };
const activeDayCleanup: DailyTask = { doneFor: null, running: null };
const statBackfill: DailyTask = { doneFor: null, running: null };

/**
 * 하루 한 번 하는 정리. 로그인한 요청(requireUser)과 /api/health가 부른다. 아무도 오지 않는 날에도
 * GitHub `health` 감시가 몇 시간마다 health를 불러 돌게 된다.
 *
 * - 빠진 하루 합계 채우기: 기다리지 않는다(빠진 날이 많으면 오래 걸린다). 실패하면 다음 요청이 다시 시도한다.
 * - 만료된 세션 지우기, 90일 지난 쓴 날짜 지우기: 서로·합계와 따로 돈다. 성공한 날은 다시 하지 않고, 실패하면 다음 요청이 다시 한다.
 *   보관 기간 약속(개인정보처리방침)이 합계 복구보다 먼저라, 합계가 실패해도 쓴 날짜는 지운다.
 */
export async function runDailyOnce(): Promise<void> {
  const today = todayKST();
  const key = formatKST(today);
  ensureSnapshots(addDays(today, -1));
  await runTask(sessionCleanup, key, deleteExpiredSessions);
  await runTask(activeDayCleanup, key, () => cleanExpiredActiveDays(today));
  // 새 열이 생기기 전에 찍은 하루 합계를 채운다. 채울 행이 없으면 질의 한 번으로 끝난다.
  await runTask(statBackfill, key, backfillStatColumns);
}

/** 같은 날 성공한 일은 건너뛰고, 동시에 온 요청은 도는 중인 것을 같이 기다린다. */
async function runTask(task: DailyTask, key: string, work: () => Promise<boolean>) {
  if (task.doneFor === key) return;
  task.running ??= work()
    .then((ok) => {
      if (ok) task.doneFor = key;
      return ok;
    })
    .finally(() => {
      task.running = null;
    });
  await task.running;
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
