import type { RoutineFreq } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { DEFAULT_EVENT_COLOR } from "@/lib/colors";
import { todayIn } from "@/lib/date";
import { formatTime, parseTime } from "@/lib/event-time";
import { LIMITS } from "@/lib/limits";
import { MCP_LIMITS } from "@/lib/mcp/inputs";
import { normalizeRule, ruleProblem } from "@/lib/mcp/routine-rule";
import { BULK_TRANSACTION, dayText, fail, ok, parseDay, pruneBatches, writeLimited, type McpContext, type ToolResult } from "@/lib/mcp/shared";
import type { Snapshot } from "@/lib/mcp/snapshot";
import { prisma } from "@/lib/prisma";

/**
 * 모든 권한(FULL) 토큰의 카테고리·루틴(할 일 루틴과 반복 일정) 도구. 서버 액션(app/(tabs)/categories/actions.ts, routines/actions.ts,
 * routines/event-routine-actions.ts)과 같은 규칙이다. 규칙을 바꿀 때 두 곳을 같이 본다(docs/mcp.md).
 * 지우는 것만 되돌리기(undo_batch)가 있고, 고친 것은 돌려주는 previous 값으로 다시 고치면 된다.
 */
const MAX_TITLE = 100;
const MAX_SNAPSHOT_IDS = 20_000;
const undoNote = `Call undo_batch with this batchId within ${MCP_LIMITS.undoHours} hours to put it back.`;

function refresh() {
  revalidatePath("/");
  revalidatePath("/categories");
  revalidatePath("/routines");
}

export async function createCategory(ctx: McpContext, input: { name: string; color: string; isPublic?: boolean }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;

  const count = await prisma.category.count({ where: { userId: ctx.userId, archivedAt: null } });
  if (count >= LIMITS.categories) return fail(`The limit is ${LIMITS.categories} categories (you have ${count}). Delete or reuse one.`);
  const last = await prisma.category.findFirst({ where: { userId: ctx.userId }, orderBy: { order: "desc" }, select: { order: true } });
  const category = await prisma.category.create({
    // 팔로워에게 보이는 것은 사용자가 시킨 때만(isPublic=true). AI가 실수로 공개하지 않게 기본은 비공개다.
    data: { userId: ctx.userId, name: input.name, color: input.color.toLowerCase(), isPublic: input.isPublic === true, order: (last?.order ?? -1) + 1 },
    select: { id: true, name: true, color: true, isPublic: true },
  });
  refresh();
  return ok({ id: category.id, name: category.name, color: category.color, visibleToFollowers: category.isPublic });
}

export async function updateCategory(ctx: McpContext, input: { id: string; name?: string; color?: string; isPublic?: boolean }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;
  if (input.name === undefined && input.color === undefined && input.isPublic === undefined) return fail("Give at least one of name, color or isPublic to change.");

  const before = await prisma.category.findFirst({ where: { id: input.id, userId: ctx.userId }, select: { id: true, name: true, color: true, isPublic: true } });
  if (!before) return fail("Category not found.");
  await prisma.category.updateMany({
    where: { id: before.id, userId: ctx.userId },
    data: { ...(input.name !== undefined && { name: input.name }), ...(input.color !== undefined && { color: input.color.toLowerCase() }), ...(input.isPublic !== undefined && { isPublic: input.isPublic }) },
  });
  refresh();
  return ok({
    id: before.id,
    previous: { name: before.name, color: before.color, visibleToFollowers: before.isPublic },
    now: { name: input.name ?? before.name, color: input.color?.toLowerCase() ?? before.color, visibleToFollowers: input.isPublic ?? before.isPublic },
  });
}

export async function deleteCategory(ctx: McpContext, input: { id: string }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;

  const category = await prisma.category.findFirst({
    where: { id: input.id, userId: ctx.userId },
    include: { todos: { select: { id: true } }, routines: { select: { id: true, pausedAt: true } } },
  });
  if (!category) return fail("Category not found.");
  // 되돌리기 기록에 할 일 id를 모두 담는다. 서버 액션의 되돌리기 상한(2만 개)과 같게 둔다.
  if (category.todos.length > MAX_SNAPSHOT_IDS) return fail("This category has too many todos to delete through the AI connection. Delete it in the app.");

  // 서버 액션 deleteCategory와 같다: 카테고리만 지우고 그 안의 할 일은 "카테고리 없음"으로 남긴다. 루틴은 멈춘다(카테고리 없이 돌면 적을 칸이 없다).
  const toPause = category.routines.filter((routine) => !routine.pausedAt);
  const snapshot: Snapshot = {
    kind: "category-deleted",
    category: {
      id: category.id,
      name: category.name,
      color: category.color,
      isPublic: category.isPublic,
      order: category.order,
      todoIds: category.todos.map((todo) => todo.id),
      routineIds: category.routines.map((routine) => routine.id),
      pausedRoutineIds: toPause.map((routine) => routine.id),
    },
  };
  const batch = await prisma.$transaction(async (tx) => {
    await tx.routine.updateMany({ where: { id: { in: toPause.map((routine) => routine.id) }, userId: ctx.userId }, data: { pausedAt: new Date() } });
    await tx.category.delete({ where: { id: category.id } });
    return tx.mcpBatch.create({ data: { userId: ctx.userId, snapshot }, select: { id: true } });
  }, BULK_TRANSACTION);
  await pruneBatches(ctx.userId);
  refresh();

  return ok({ batchId: batch.id, deleted: category.name, todosKeptWithoutCategory: category.todos.length, routinesPaused: toPause.length, undo: undoNote });
}

const clock = (minutes: number | null) => (minutes === null ? null : formatTime(minutes));

export async function listRoutines(ctx: McpContext): Promise<ToolResult> {
  const [routines, eventRoutines] = await Promise.all([
    prisma.routine.findMany({ where: { userId: ctx.userId }, orderBy: { order: "asc" }, include: { category: { select: { id: true, name: true } } } }),
    prisma.eventRoutine.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "asc" } }),
  ]);
  const rule = (row: { freq: RoutineFreq; byWeekday: number[]; byMonthday: number[]; startDate: Date; endDate: Date | null; pausedAt: Date | null }) => ({
    frequency: row.freq,
    weekdays: row.byWeekday,
    monthdays: row.byMonthday,
    startDate: dayText(row.startDate),
    endDate: row.endDate ? dayText(row.endDate) : null,
    paused: row.pausedAt !== null,
  });
  return ok({
    // 루틴이 만드는 할 일은 그 날을 앱에서 열어야 생긴다. list_todos에는 열지 않은 날의 것이 아직 없을 수 있다.
    routines: [
      ...routines.map((row) => ({ id: row.id, kind: "todo", title: row.content, category: row.category ? { id: row.category.id, name: row.category.name } : null, ...rule(row) })),
      ...eventRoutines.map((row) => ({
        id: row.id,
        kind: "event",
        title: row.title,
        color: row.color,
        startTime: clock(row.startTime),
        endTime: clock(row.endTime),
        visibleToFollowers: row.isPublic,
        ...rule(row),
      })),
    ],
  });
}

type RoutineInput = {
  kind?: "todo" | "event";
  title: string;
  category?: string;
  frequency: RoutineFreq;
  weekdays?: number[];
  monthdays?: number[];
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  color?: string;
  isPublic?: boolean;
};

/** 할 일 루틴과 반복 일정의 상한은 둘을 합쳐 센다(서버 액션과 같다). */
async function routineCount(userId: string): Promise<number> {
  const [todos, events] = await Promise.all([prisma.routine.count({ where: { userId } }), prisma.eventRoutine.count({ where: { userId } })]);
  return todos + events;
}

export async function createRoutine(ctx: McpContext, input: RoutineInput): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;

  const startDate = input.startDate === undefined ? todayIn(ctx.timezone) : parseDay(input.startDate);
  const endDate = input.endDate === undefined ? null : parseDay(input.endDate);
  if (!startDate || (input.endDate !== undefined && !endDate)) return fail("startDate and endDate must be real dates (YYYY-MM-DD).");
  const rule = normalizeRule({ freq: input.frequency, byWeekday: input.weekdays ?? [], byMonthday: input.monthdays ?? [], startDate, endDate });
  const problem = ruleProblem(rule);
  if (problem) return fail(problem);
  if ((await routineCount(ctx.userId)) >= LIMITS.routines) return fail(`The limit is ${LIMITS.routines} routines (repeating events count too).`);

  if (input.kind === "event") {
    if ([...input.title].length > MAX_TITLE) return fail(`An event title is at most ${MAX_TITLE} characters.`);
    const startTime = parseTime(input.startTime ?? "");
    const endTime = parseTime(input.endTime ?? "");
    if (startTime === undefined || endTime === undefined) return fail("startTime and endTime must be HH:MM.");
    if (startTime === null && endTime !== null) return fail("endTime needs a startTime.");
    if (startTime !== null && endTime !== null && endTime < startTime) return fail("endTime is before startTime.");
    const row = await prisma.eventRoutine.create({
      data: {
        userId: ctx.userId,
        title: input.title,
        color: input.color ? input.color.toLowerCase() : DEFAULT_EVENT_COLOR,
        startTime,
        endTime,
        isPublic: input.isPublic === true,
        ...rule,
      },
      select: { id: true },
    });
    refresh();
    return ok({ id: row.id, kind: "event" });
  }

  // 루틴은 카테고리 안에 들어간다. 카테고리 없는 루틴은 만든 할 일이 적을 수 없는 "카테고리 없음"에 쌓인다.
  if (!input.category) return fail("category is required for a todo routine (id or exact name from get_overview).");
  const categories = await prisma.category.findMany({ where: { userId: ctx.userId, archivedAt: null }, select: { id: true, name: true } });
  const category = categories.find((each) => each.id === input.category) ?? categories.find((each) => each.name.trim().toLowerCase() === input.category?.trim().toLowerCase());
  if (!category) return fail(`Category "${input.category}" was not found. Available: ${categories.map((each) => each.name).join(", ") || "(none)"}.`);
  const last = await prisma.routine.findFirst({ where: { userId: ctx.userId }, orderBy: { order: "desc" }, select: { order: true } });
  const row = await prisma.routine.create({
    data: { userId: ctx.userId, content: input.title, categoryId: category.id, order: (last?.order ?? -1) + 1, ...rule },
    select: { id: true },
  });
  refresh();
  return ok({ id: row.id, kind: "todo" });
}

type RoutineUpdate = {
  id: string;
  title?: string;
  category?: string;
  frequency?: RoutineFreq;
  weekdays?: number[];
  monthdays?: number[];
  startDate?: string;
  endDate?: string | null;
  paused?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  color?: string;
  isPublic?: boolean;
};

const RULE_FIELDS = ["frequency", "weekdays", "monthdays", "startDate", "endDate"] as const;

/** 규칙 칸을 하나라도 받으면 지금 값과 합쳐 다시 검사한다. 받지 않았으면 null(규칙은 그대로). */
function mergeRule(
  row: { freq: RoutineFreq; byWeekday: number[]; byMonthday: number[]; startDate: Date; endDate: Date | null },
  input: RoutineUpdate,
): ReturnType<typeof normalizeRule> | string | null {
  if (!RULE_FIELDS.some((field) => input[field] !== undefined)) return null;
  const startDate = input.startDate === undefined ? row.startDate : parseDay(input.startDate);
  const endDate = input.endDate === undefined ? row.endDate : input.endDate === null ? null : parseDay(input.endDate);
  if (!startDate || (typeof input.endDate === "string" && !endDate)) return "startDate and endDate must be real dates (YYYY-MM-DD).";
  const rule = normalizeRule({ freq: input.frequency ?? row.freq, byWeekday: input.weekdays ?? row.byWeekday, byMonthday: input.monthdays ?? row.byMonthday, startDate, endDate });
  return ruleProblem(rule) ?? rule;
}

const describeRule = (row: { freq: RoutineFreq; byWeekday: number[]; byMonthday: number[]; startDate: Date; endDate: Date | null }) => ({
  frequency: row.freq,
  weekdays: row.byWeekday,
  monthdays: row.byMonthday,
  startDate: dayText(row.startDate),
  endDate: row.endDate ? dayText(row.endDate) : null,
});

export async function updateRoutine(ctx: McpContext, input: RoutineUpdate): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;
  if (Object.entries(input).every(([key, value]) => key === "id" || key === "kind" || value === undefined)) return fail("Give at least one field to change besides id.");

  const todoRoutine = await prisma.routine.findFirst({ where: { id: input.id, userId: ctx.userId } });
  if (todoRoutine) return updateTodoRoutine(ctx, todoRoutine, input);
  const eventRoutine = await prisma.eventRoutine.findFirst({ where: { id: input.id, userId: ctx.userId } });
  if (eventRoutine) return updateEventRoutine(ctx, eventRoutine, input);
  return fail("Routine not found.");
}

async function updateTodoRoutine(
  ctx: McpContext,
  row: NonNullable<Awaited<ReturnType<typeof prisma.routine.findFirst>>>,
  input: RoutineUpdate,
): Promise<ToolResult> {
  const rule = mergeRule(row, input);
  if (typeof rule === "string") return fail(rule);

  let categoryId = row.categoryId;
  if (input.category !== undefined) {
    const categories = await prisma.category.findMany({ where: { userId: ctx.userId, archivedAt: null }, select: { id: true, name: true } });
    const category = categories.find((each) => each.id === input.category) ?? categories.find((each) => each.name.trim().toLowerCase() === input.category?.trim().toLowerCase());
    if (!category) return fail(`Category "${input.category}" was not found. Available: ${categories.map((each) => each.name).join(", ") || "(none)"}.`);
    categoryId = category.id;
  }
  // 카테고리를 지워 멈춘 루틴은 새 카테고리를 고르면 다시 돌릴 수 있다. 카테고리 없이 돌면 적을 칸이 없다(서버 액션 toggleRoutinePause와 같다).
  if (input.paused === false && !categoryId) return fail("This routine has no category (it was deleted). Give a category to resume it.");

  const content = input.title ?? row.content;
  const pausedAt = input.paused === undefined ? row.pausedAt : input.paused ? (row.pausedAt ?? new Date()) : null;
  const today = todayIn(ctx.timezone);
  await prisma.$transaction([
    prisma.routine.update({ where: { id: row.id }, data: { content, categoryId, pausedAt, ...(rule ?? {}) } }),
    // 서버 액션 updateRoutine과 같다: 오늘 이후의 아직 안 끝낸 할 일도 새 내용·카테고리로 바꾼다. 지난 날과 끝낸 일은 기록이라 그대로 둔다.
    ...(input.title !== undefined || input.category !== undefined
      ? [prisma.todo.updateMany({ where: { routineId: row.id, userId: ctx.userId, done: false, date: { gte: today } }, data: { content, categoryId, ...(categoryId !== row.categoryId && { color: null }) } })]
      : []),
  ]);
  refresh();
  return ok({
    id: row.id,
    kind: "todo",
    previous: { title: row.content, categoryId: row.categoryId, paused: row.pausedAt !== null, ...describeRule(row) },
  });
}

async function updateEventRoutine(
  ctx: McpContext,
  row: NonNullable<Awaited<ReturnType<typeof prisma.eventRoutine.findFirst>>>,
  input: RoutineUpdate,
): Promise<ToolResult> {
  if (input.category !== undefined) return fail("Repeating events have no category.");
  const rule = mergeRule(row, input);
  if (typeof rule === "string") return fail(rule);

  const title = input.title ?? row.title;
  if ([...title].length > MAX_TITLE) return fail(`An event title is at most ${MAX_TITLE} characters.`);
  // 시작 시각을 지우면(하루 종일) 끝 시각도 같이 지운다.
  const startTime = input.startTime === undefined ? row.startTime : input.startTime === null ? null : parseTime(input.startTime);
  const parsedEnd = input.endTime === undefined ? row.endTime : input.endTime === null ? null : parseTime(input.endTime);
  if (startTime === undefined || parsedEnd === undefined) return fail("startTime and endTime must be HH:MM.");
  const endTime = input.endTime === undefined && startTime === null ? null : parsedEnd;
  if (startTime === null && endTime !== null) return fail("endTime needs a startTime.");
  if (startTime !== null && endTime !== null && endTime < startTime) return fail("endTime is before startTime.");

  await prisma.eventRoutine.updateMany({
    where: { id: row.id, userId: ctx.userId },
    data: {
      title,
      startTime,
      endTime,
      color: input.color ? input.color.toLowerCase() : row.color,
      isPublic: input.isPublic ?? row.isPublic,
      pausedAt: input.paused === undefined ? row.pausedAt : input.paused ? (row.pausedAt ?? new Date()) : null,
      ...(rule ?? {}),
    },
  });
  refresh();
  return ok({
    id: row.id,
    kind: "event",
    previous: { title: row.title, color: row.color, startTime: clock(row.startTime), endTime: clock(row.endTime), visibleToFollowers: row.isPublic, paused: row.pausedAt !== null, ...describeRule(row) },
  });
}

export async function deleteRoutine(ctx: McpContext, input: { id: string }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;

  const routine = await prisma.routine.findFirst({
    where: { id: input.id, userId: ctx.userId },
    include: { todos: { select: { id: true } }, skips: { select: { date: true } } },
  });
  if (routine) {
    // 서버 액션 deleteRoutine과 같다: 이미 만들어진 할 일은 남는다(스키마의 onDelete: SetNull이 routineId만 비운다).
    const snapshot: Snapshot = {
      kind: "routine-deleted",
      routine: {
        id: routine.id,
        content: routine.content,
        freq: routine.freq,
        byWeekday: routine.byWeekday,
        byMonthday: routine.byMonthday,
        categoryId: routine.categoryId,
        startDate: dayText(routine.startDate),
        endDate: routine.endDate ? dayText(routine.endDate) : null,
        paused: routine.pausedAt !== null,
        order: routine.order,
        todoIds: routine.todos.map((todo) => todo.id),
        skipDates: routine.skips.map((skip) => dayText(skip.date)),
      },
    };
    const batch = await prisma.$transaction(async (tx) => {
      await tx.routine.delete({ where: { id: routine.id } });
      return tx.mcpBatch.create({ data: { userId: ctx.userId, snapshot }, select: { id: true } });
    }, BULK_TRANSACTION);
    await pruneBatches(ctx.userId);
    refresh();
    return ok({ batchId: batch.id, deleted: routine.content, kind: "todo", todosKept: routine.todos.length, undo: undoNote });
  }

  const eventRoutine = await prisma.eventRoutine.findFirst({ where: { id: input.id, userId: ctx.userId }, include: { skips: { select: { date: true } } } });
  if (!eventRoutine) return fail("Routine not found.");
  const snapshot: Snapshot = {
    kind: "event-routine-deleted",
    routine: {
      id: eventRoutine.id,
      title: eventRoutine.title,
      color: eventRoutine.color,
      startTime: eventRoutine.startTime,
      endTime: eventRoutine.endTime,
      freq: eventRoutine.freq,
      byWeekday: eventRoutine.byWeekday,
      byMonthday: eventRoutine.byMonthday,
      startDate: dayText(eventRoutine.startDate),
      endDate: eventRoutine.endDate ? dayText(eventRoutine.endDate) : null,
      paused: eventRoutine.pausedAt !== null,
      isPublic: eventRoutine.isPublic,
      skipDates: eventRoutine.skips.map((skip) => dayText(skip.date)),
    },
  };
  const batch = await prisma.$transaction(async (tx) => {
    await tx.eventRoutine.delete({ where: { id: eventRoutine.id } });
    return tx.mcpBatch.create({ data: { userId: ctx.userId, snapshot }, select: { id: true } });
  }, BULK_TRANSACTION);
  await pruneBatches(ctx.userId);
  refresh();
  return ok({ batchId: batch.id, deleted: eventRoutine.title, kind: "event", undo: undoNote });
}
