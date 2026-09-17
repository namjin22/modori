import { cache } from "react";

import {
  addDays,
  daysBetween,
  formatKST,
  parseKSTDate,
  toKSTDateOnly,
  todayKST,
} from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { matchesRule } from "@/lib/routine";

// 과거로 스크롤할 때 미완료 루틴이 우수수 생기면 통계가 망가진다.
const PAST_LIMIT_DAYS = 30;

type Owner = { id: string; createdAt: Date };

/** 그 날짜에 실제로 할 일을 만들어도 되는 구간인가. */
function isMaterializable(owner: Owner, date: Date): boolean {
  const today = todayKST();

  // 미래는 만들지 않는다. 캘린더를 몇 번 넘기는 것만으로 수천 행이 생긴다.
  if (daysBetween(today, date) > 0) return false;

  const createdAt = toKSTDateOnly(owner.createdAt);
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
      OR: [{ endDate: null }, { endDate: { gte: date } }],
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
