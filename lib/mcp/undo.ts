import { revalidatePath } from "next/cache";

import { parseKSTDate } from "@/lib/date";
import { firstOverfullDay } from "@/lib/event-limit";
import { LIMITS } from "@/lib/limits";
import { BULK_TRANSACTION, dayText, fail, ok, type McpContext, type ToolResult } from "@/lib/mcp/shared";
import type { Snapshot } from "@/lib/mcp/snapshot";
import { prisma } from "@/lib/prisma";
import { settleSubTodos } from "@/lib/sub-todos";

/**
 * 지우거나 고치기 전의 모습(Snapshot)으로 되돌린다. 서버 액션의 되돌리기(restoreTodo, restoreEvent, undoDeleteCategory, restoreRoutine,
 * restoreEventRoutine)와 같은 규칙: 되돌리기도 새로 만드는 것과 같은 상한을 지키고, 카테고리·루틴은 아직 본인 것으로 있을 때만 다시 잇는다.
 * 같은 id가 이미 있으면 만들지 않는다(두 번 눌렀거나 이미 되살아난 경우). 되돌리지 못한 것은 이유와 함께 skipped로 알린다.
 * 지운 할 일에 달려 있던 친구의 반응은 지울 때 같이 사라져 돌아오지 않는다.
 */
type Skipped = { id: string; reason: string };

function refresh() {
  revalidatePath("/");
  revalidatePath("/categories");
  revalidatePath("/routines");
}

const at = (value: string) => parseKSTDate(value);

export async function restoreSnapshot(ctx: McpContext, snapshot: Snapshot): Promise<ToolResult> {
  switch (snapshot.kind) {
    case "todos-deleted":
      return restoreTodos(ctx, snapshot.rows);
    case "todos-updated":
      return revertTodos(ctx, snapshot.rows);
    case "events-deleted":
      return restoreEvents(ctx, snapshot.rows);
    case "events-updated":
      return revertEvents(ctx, snapshot.rows);
    case "category-deleted":
      return restoreCategory(ctx, snapshot.category);
    case "routine-deleted":
      return restoreRoutine(ctx, snapshot.routine);
    case "event-routine-deleted":
      return restoreEventRoutine(ctx, snapshot.routine);
  }
}

type Rows<K extends Snapshot["kind"]> = Extract<Snapshot, { kind: K }> extends { rows: infer R } ? R : never;

async function restoreTodos(ctx: McpContext, rows: Rows<"todos-deleted">): Promise<ToolResult> {
  const existing = new Set((await prisma.todo.findMany({ where: { id: { in: rows.map((row) => row.id) } }, select: { id: true } })).map((todo) => todo.id));
  const categoryIds = [...new Set(rows.flatMap((row) => (row.categoryId ? [row.categoryId] : [])))];
  const routineIds = [...new Set(rows.flatMap((row) => (row.routineId ? [row.routineId] : [])))];
  // 세부 할 일이었으면 큰 할 일이 아직 있을 때 다시 단다(2026-11-20). 큰 할 일이 그 사이 다른 날로 갔으면 그 날·카테고리를 따른다(앱의 restoreTodo와 같다).
  // 큰 할 일이 없거나 세부 할 일이 되었으면 보통 할 일로 되살린다.
  const parentRefs = [...new Set(rows.flatMap((row) => (row.parentId ? [row.parentId] : [])))];
  const liveParents = new Map(
    (await prisma.todo.findMany({ where: { id: { in: parentRefs }, userId: ctx.userId, parentId: null }, select: { id: true, date: true, categoryId: true } })).map((parent) => [parent.id, parent]),
  );
  const dayOf = (row: (typeof rows)[number]) => {
    const live = row.parentId ? liveParents.get(row.parentId) : undefined;
    return live ? dayText(live.date) : row.date;
  };
  const [categories, routines, counts] = await Promise.all([
    prisma.category.findMany({ where: { id: { in: categoryIds }, userId: ctx.userId }, select: { id: true } }),
    prisma.routine.findMany({ where: { id: { in: routineIds }, userId: ctx.userId }, select: { id: true } }),
    prisma.todo.groupBy({ by: ["date"], where: { userId: ctx.userId, date: { in: [...new Set(rows.map(dayOf))].map(at) } }, _count: { _all: true } }),
  ]);
  const categoryOk = new Set(categories.map((category) => category.id));
  const routineOk = new Set(routines.map((routine) => routine.id));
  const perDay = new Map(counts.map((row) => [dayText(row.date), row._count._all]));

  const skipped: Skipped[] = [];
  const create: typeof rows = [];
  for (const row of rows) {
    if (existing.has(row.id)) {
      skipped.push({ id: row.id, reason: "already exists" });
      continue;
    }
    const day = dayOf(row);
    const have = perDay.get(day) ?? 0;
    if (have >= LIMITS.todosPerDay) {
      skipped.push({ id: row.id, reason: `${day} already has ${LIMITS.todosPerDay} todos` });
      continue;
    }
    perDay.set(day, have + 1);
    create.push(row);
  }
  const createIds = new Set(create.map((row) => row.id));

  const restoredRoutineDays = create.flatMap((row) => (row.routineId && routineOk.has(row.routineId) ? [{ routineId: row.routineId, date: at(row.date) }] : []));
  const made = await prisma.$transaction(async (tx) => {
    // 루틴이 만든 할 일을 지울 때 "그 날은 건너뛴다"고 남겼다. 되살리면 그 기록은 지운다.
    if (restoredRoutineDays.length > 0) await tx.routineSkip.deleteMany({ where: { OR: restoredRoutineDays } });
    return tx.todo.createMany({
      data: create.map((row) => {
        const live = row.parentId ? liveParents.get(row.parentId) : undefined;
        // 같이 되살리는 큰 할 일 밑이거나 아직 있는 큰 할 일 밑이면 다시 단다. 아니면 보통 할 일이다.
        const parentId = row.parentId && (live || createIds.has(row.parentId)) ? row.parentId : null;
        return {
          id: row.id,
          userId: ctx.userId,
          content: row.content,
          date: live ? live.date : at(row.date),
          done: row.done,
          doneAt: row.doneAt ? new Date(row.doneAt) : null,
          order: row.order,
          categoryId: live ? live.categoryId : row.categoryId && categoryOk.has(row.categoryId) ? row.categoryId : null,
          color: row.color,
          routineId: row.routineId && routineOk.has(row.routineId) ? row.routineId : null,
          memo: row.memo,
          memoPublic: row.memoPublic,
          parentId,
          createdAt: new Date(row.createdAt),
        };
      }),
      skipDuplicates: true,
    });
  }, BULK_TRANSACTION);
  refresh();
  return ok({ restoredTodos: made.count, skipped });
}

async function revertTodos(ctx: McpContext, rows: Rows<"todos-updated">): Promise<ToolResult> {
  const categoryIds = [...new Set(rows.flatMap((row) => (row.categoryId ? [row.categoryId] : [])))];
  const categoryOk = new Set((await prisma.category.findMany({ where: { id: { in: categoryIds }, userId: ctx.userId }, select: { id: true } })).map((category) => category.id));
  const results = await prisma.$transaction(
    rows.map((row) =>
      prisma.todo.updateMany({
        where: { id: row.id, userId: ctx.userId },
        data: {
          content: row.content,
          memo: row.memo,
          memoPublic: row.memoPublic,
          color: row.color,
          // 그 사이 지워진 카테고리로는 돌려놓지 않는다(지금 카테고리를 그대로 둔다).
          ...(row.categoryId === null ? { categoryId: null } : categoryOk.has(row.categoryId) ? { categoryId: row.categoryId } : {}),
        },
      }),
    ),
  );
  const restored = results.reduce((sum, result) => sum + result.count, 0);
  await settleSubTodos(ctx.userId, rows.map((row) => row.id));
  refresh();
  return ok({ revertedTodos: restored, notFound: rows.filter((_row, index) => results[index].count === 0).map((row) => row.id) });
}

async function restoreEvents(ctx: McpContext, rows: Rows<"events-deleted">): Promise<ToolResult> {
  if (rows.length === 0) return ok({ restoredEvents: 0, skipped: [] });
  const existing = new Set((await prisma.event.findMany({ where: { id: { in: rows.map((row) => row.id) } }, select: { id: true } })).map((event) => event.id));
  let total = await prisma.event.count({ where: { userId: ctx.userId } });
  const first = rows.reduce((min, row) => (row.startDate < min ? row.startDate : min), rows[0].startDate);
  const last = rows.reduce((max, row) => (row.endDate > max ? row.endDate : max), rows[0].endDate);
  const accepted = await prisma.event.findMany({ where: { userId: ctx.userId, startDate: { lte: at(last) }, endDate: { gte: at(first) } }, select: { startDate: true, endDate: true } });

  const skipped: Skipped[] = [];
  const create: typeof rows = [];
  for (const row of rows) {
    if (existing.has(row.id)) {
      skipped.push({ id: row.id, reason: "already exists" });
      continue;
    }
    if (total >= LIMITS.events) {
      skipped.push({ id: row.id, reason: `the limit is ${LIMITS.events} events in total` });
      continue;
    }
    const full = firstOverfullDay(accepted, at(row.startDate), at(row.endDate), LIMITS.eventsPerDay);
    if (full) {
      skipped.push({ id: row.id, reason: `${dayText(full)} already has ${LIMITS.eventsPerDay} events` });
      continue;
    }
    accepted.push({ startDate: at(row.startDate), endDate: at(row.endDate) });
    total += 1;
    create.push(row);
  }

  const made = await prisma.event.createMany({
    data: create.map((row) => ({
      id: row.id,
      userId: ctx.userId,
      title: row.title,
      startDate: at(row.startDate),
      endDate: at(row.endDate),
      startTime: row.startTime,
      endTime: row.endTime,
      color: row.color,
      memo: row.memo,
      dday: row.dday,
      isPublic: row.isPublic,
      memoPublic: row.memoPublic,
      sortOrder: row.sortOrder,
      createdAt: new Date(row.createdAt),
    })),
    skipDuplicates: true,
  });
  refresh();
  return ok({ restoredEvents: made.count, skipped });
}

async function revertEvents(ctx: McpContext, rows: Rows<"events-updated">): Promise<ToolResult> {
  if (rows.length === 0) return ok({ revertedEvents: 0, skipped: [] });
  const first = rows.reduce((min, row) => (row.startDate < min ? row.startDate : min), rows[0].startDate);
  const last = rows.reduce((max, row) => (row.endDate > max ? row.endDate : max), rows[0].endDate);
  const ids = rows.map((row) => row.id);
  const others = await prisma.event.findMany({
    where: { userId: ctx.userId, id: { notIn: ids }, startDate: { lte: at(last) }, endDate: { gte: at(first) } },
    select: { startDate: true, endDate: true },
  });

  const skipped: Skipped[] = [];
  const apply: typeof rows = [];
  for (const row of rows) {
    const full = firstOverfullDay(others, at(row.startDate), at(row.endDate), LIMITS.eventsPerDay);
    if (full) {
      skipped.push({ id: row.id, reason: `${dayText(full)} already has ${LIMITS.eventsPerDay} events` });
      continue;
    }
    others.push({ startDate: at(row.startDate), endDate: at(row.endDate) });
    apply.push(row);
  }
  const results = await prisma.$transaction(
    apply.map((row) =>
      prisma.event.updateMany({
        where: { id: row.id, userId: ctx.userId },
        data: {
          title: row.title,
          startDate: at(row.startDate),
          endDate: at(row.endDate),
          startTime: row.startTime,
          endTime: row.endTime,
          color: row.color,
          memo: row.memo,
          dday: row.dday,
          isPublic: row.isPublic,
          memoPublic: row.memoPublic,
        },
      }),
    ),
  );
  refresh();
  return ok({
    revertedEvents: results.reduce((sum, result) => sum + result.count, 0),
    skipped: [...skipped, ...apply.filter((_row, index) => results[index].count === 0).map((row) => ({ id: row.id, reason: "not found" }))],
  });
}

async function restoreCategory(ctx: McpContext, category: Extract<Snapshot, { kind: "category-deleted" }>["category"]): Promise<ToolResult> {
  if (await prisma.category.findUnique({ where: { id: category.id }, select: { id: true } })) return fail("That category already exists again.");
  const count = await prisma.category.count({ where: { userId: ctx.userId, archivedAt: null } });
  if (count >= LIMITS.categories) return fail(`The limit is ${LIMITS.categories} categories. Delete one first.`);

  const [, todos, routines, resumed] = await prisma.$transaction([
    prisma.category.create({ data: { id: category.id, userId: ctx.userId, name: category.name, color: category.color, isPublic: category.isPublic, order: category.order } }),
    // 그 사이 다른 카테고리로 옮긴 것은 건드리지 않는다.
    prisma.todo.updateMany({ where: { id: { in: category.todoIds }, userId: ctx.userId, categoryId: null }, data: { categoryId: category.id } }),
    prisma.routine.updateMany({ where: { id: { in: category.routineIds }, userId: ctx.userId, categoryId: null }, data: { categoryId: category.id } }),
    prisma.routine.updateMany({ where: { id: { in: category.pausedRoutineIds }, userId: ctx.userId }, data: { pausedAt: null } }),
  ]);
  refresh();
  return ok({ restoredCategory: category.name, relinkedTodos: todos.count, relinkedRoutines: routines.count, resumedRoutines: resumed.count });
}

async function routineCount(userId: string): Promise<number> {
  const [todos, events] = await Promise.all([prisma.routine.count({ where: { userId } }), prisma.eventRoutine.count({ where: { userId } })]);
  return todos + events;
}

async function restoreRoutine(ctx: McpContext, routine: Extract<Snapshot, { kind: "routine-deleted" }>["routine"]): Promise<ToolResult> {
  if (await prisma.routine.findUnique({ where: { id: routine.id }, select: { id: true } })) return fail("That routine already exists again.");
  if ((await routineCount(ctx.userId)) >= LIMITS.routines) return fail(`The limit is ${LIMITS.routines} routines (repeating events count too).`);
  const category = routine.categoryId ? await prisma.category.findFirst({ where: { id: routine.categoryId, userId: ctx.userId }, select: { id: true } }) : null;

  await prisma.$transaction([
    prisma.routine.create({
      data: {
        id: routine.id,
        userId: ctx.userId,
        content: routine.content,
        freq: routine.freq,
        byWeekday: routine.byWeekday,
        byMonthday: routine.byMonthday,
        categoryId: category?.id ?? null,
        startDate: at(routine.startDate),
        endDate: routine.endDate ? at(routine.endDate) : null,
        // 그 사이 카테고리가 지워졌으면 멈춘 채로 되살린다. 카테고리 없이 돌면 적을 칸이 없다.
        pausedAt: routine.paused || !category ? new Date() : null,
        order: routine.order,
      },
    }),
    prisma.todo.updateMany({ where: { id: { in: routine.todoIds }, userId: ctx.userId, routineId: null }, data: { routineId: routine.id } }),
    prisma.routineSkip.createMany({ data: routine.skipDates.map((date) => ({ routineId: routine.id, date: at(date) })), skipDuplicates: true }),
  ]);
  refresh();
  return ok({ restoredRoutine: routine.content, pausedBecauseCategoryIsGone: !category });
}

async function restoreEventRoutine(ctx: McpContext, routine: Extract<Snapshot, { kind: "event-routine-deleted" }>["routine"]): Promise<ToolResult> {
  if (await prisma.eventRoutine.findUnique({ where: { id: routine.id }, select: { id: true } })) return fail("That repeating event already exists again.");
  if ((await routineCount(ctx.userId)) >= LIMITS.routines) return fail(`The limit is ${LIMITS.routines} routines (repeating events count too).`);

  await prisma.$transaction([
    prisma.eventRoutine.create({
      data: {
        id: routine.id,
        userId: ctx.userId,
        title: routine.title,
        color: routine.color,
        startTime: routine.startTime,
        endTime: routine.endTime,
        freq: routine.freq,
        byWeekday: routine.byWeekday,
        byMonthday: routine.byMonthday,
        startDate: at(routine.startDate),
        endDate: routine.endDate ? at(routine.endDate) : null,
        pausedAt: routine.paused ? new Date() : null,
        isPublic: routine.isPublic,
      },
    }),
    prisma.eventRoutineSkip.createMany({ data: routine.skipDates.map((date) => ({ eventRoutineId: routine.id, date: at(date) })), skipDuplicates: true }),
  ]);
  refresh();
  return ok({ restoredRepeatingEvent: routine.title });
}
