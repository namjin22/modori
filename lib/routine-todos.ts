import { cache } from "react";

import {
  addDays,
  daysBetween,
  formatKST,
  parseKSTDate,
  dateIn,
  todayIn,
} from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { matchesRule } from "@/lib/routine";

// 과거로 스크롤할 때 미완료 루틴이 우수수 생기면 통계가 망가진다.
const PAST_LIMIT_DAYS = 30;

type Owner = { id: string; createdAt: Date; timezone: string };

/** 그 날짜에 실제로 할 일을 만들어도 되는 구간인가. */
function isMaterializable(owner: Owner, date: Date): boolean {
  const today = todayIn(owner.timezone);

  // 미래는 만들지 않는다. 캘린더를 몇 번 넘기는 것만으로 수천 행이 생긴다.
  if (daysBetween(today, date) > 0) return false;

  // 가입한 날도 그 사람의 시간대로 센다(캐나다에서 가입한 저녁이 서울로는 다음 날이라, 서울로 세면 가입 첫날 루틴이 안 생긴다).
  const createdAt = dateIn(owner.createdAt, owner.timezone);
  const thirtyDaysAgo = addDays(today, -PAST_LIMIT_DAYS);
  const lowerBound =
    daysBetween(createdAt, thirtyDaysAgo) > 0 ? thirtyDaysAgo : createdAt;

  return daysBetween(lowerBound, date) >= 0;
}

/**
 * 오늘 화면 한 번 그릴 때 ensureRoutineTodos와 listScheduledRoutines가 둘 다
 * 이 조회를 한다. cache()로 한 요청 안에서는 한 번만 나가게 한다.
 * cache()는 인자를 참조로 비교하므로 Date 대신 날짜 문자열을 키로 쓴다.
 */
const findDueRoutinesCached = cache(async (userId: string, dateKey: string) => {
  const date = parseKSTDate(dateKey);
  const routines = await prisma.routine.findMany({
    where: {
      userId,
      pausedAt: null,
      startDate: { lte: date },
      AND: [
        { OR: [{ endDate: null }, { endDate: { gte: date } }] },
        // 보관한 카테고리에는 새로 적을 수 없다. 루틴도 그동안 쉬고, 되살리면 다시 돈다.
        { OR: [{ categoryId: null }, { category: { archivedAt: null } }] },
      ],
      // 사용자가 그 날의 할 일을 지웠으면 다시 만들지 않는다.
      skips: { none: { date } },
    },
    orderBy: { order: "asc" },
  });

  return routines.filter((routine) => matchesRule(routine, date));
});

function findDueRoutines(userId: string, date: Date) {
  return findDueRoutinesCached(userId, formatKST(date));
}

/**
 * 그 날짜를 조회하는 순간, 없으면 만든다.
 * cron을 쓰지 않는 이유는 docs/decisions.md 참고.
 */
export async function ensureRoutineTodos(owner: Owner, date: Date) {
  if (!isMaterializable(owner, date)) return;

  const due = await findDueRoutines(owner.id, date);
  if (due.length === 0) return;

  const last = await prisma.todo.findFirst({
    where: { userId: owner.id, date },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  let order = (last?.order ?? -1) + 1;

  // 동시 요청으로 인한 중복은 @@unique([routineId, date])가 막는다.
  await prisma.todo.createMany({
    data: due.map((routine) => ({
      userId: owner.id,
      date,
      content: routine.content,
      categoryId: routine.categoryId,
      routineId: routine.id,
      order: order++,
    })),
    skipDuplicates: true,
  });
}

/** 미래 날짜에서 "예정"으로만 보여줄 루틴들. 아직 행을 만들지 않는다. */
export async function listScheduledRoutines(userId: string, date: Date) {
  const due = await findDueRoutines(userId, date);
  if (due.length === 0) return [];

  const existing = await prisma.todo.findMany({
    where: { userId, date, routineId: { in: due.map((routine) => routine.id) } },
    select: { routineId: true },
  });
  const created = new Set(existing.map((todo) => todo.routineId));

  return due
    .filter((routine) => !created.has(routine.id))
    .map((routine) => ({
      id: routine.id,
      content: routine.content,
      categoryId: routine.categoryId,
    }));
}

export type ScheduledRoutine = { id: string; content: string; categoryId: string | null };

/**
 * 기간(양 끝 포함)에 아직 할 일로 만들어지지 않은 루틴을 날짜별로 한 번에 구한다. 홈 화면이 한 달치를 한꺼번에 받아 두고
 * 날짜를 브라우저에서 바꾸므로, 날마다 따로 묻던 listScheduledRoutines를 대신한다. 질의는 기간 길이와 상관없이 두 번이다.
 * pending은 그중 지금 만들어도 되는 날(오늘·지난 30일)이다. 화면은 그 날을 열 때 서버에 한 번 다녀와 만든다.
 * 열지 않은 날까지 미리 만들면 쓰지 않은 날의 미완료 루틴이 쌓여 기록의 완료율이 낮아지므로, "열 때 만든다"는 원칙은 그대로 둔다.
 */
export async function listRoutineRange(
  owner: Owner,
  from: Date,
  to: Date,
): Promise<{ scheduled: Record<string, ScheduledRoutine[]>; pending: string[] }> {
  const scheduled: Record<string, ScheduledRoutine[]> = {};
  const pending: string[] = [];
  const routines = await prisma.routine.findMany({
    where: {
      userId: owner.id,
      pausedAt: null,
      startDate: { lte: to },
      AND: [
        { OR: [{ endDate: null }, { endDate: { gte: from } }] },
        // 보관한 카테고리에는 새로 적을 수 없다. 루틴도 그동안 쉬고, 되살리면 다시 돈다.
        { OR: [{ categoryId: null }, { category: { archivedAt: null } }] },
      ],
    },
    orderBy: { order: "asc" },
    include: { skips: { where: { date: { gte: from, lte: to } }, select: { date: true } } },
  });
  if (routines.length === 0) return { scheduled, pending };

  const existing = await prisma.todo.findMany({
    where: { userId: owner.id, date: { gte: from, lte: to }, routineId: { in: routines.map((routine) => routine.id) } },
    select: { routineId: true, date: true },
  });
  const made = new Set(existing.map((todo) => `${todo.routineId}|${formatKST(todo.date)}`));
  // 사용자가 그 날의 할 일을 지웠으면 다시 만들지 않는다.
  const skipped = new Set(routines.flatMap((routine) => routine.skips.map((skip) => `${routine.id}|${formatKST(skip.date)}`)));

  for (let day = from; daysBetween(day, to) >= 0; day = addDays(day, 1)) {
    const key = formatKST(day);
    const missing = routines.filter(
      (routine) => matchesRule(routine, day) && !made.has(`${routine.id}|${key}`) && !skipped.has(`${routine.id}|${key}`),
    );
    if (missing.length === 0) continue;
    scheduled[key] = missing.map((routine) => ({ id: routine.id, content: routine.content, categoryId: routine.categoryId }));
    if (isMaterializable(owner, day)) pending.push(key);
  }
  return { scheduled, pending };
}
