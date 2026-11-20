import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { DEFAULT_EVENT_COLOR } from "@/lib/colors";
import { daysBetween, isSameKSTDate, parseKSTDate, todayIn } from "@/lib/date";
import { firstOverfullDay } from "@/lib/event-limit";
import { formatTime, parseTime } from "@/lib/event-time";
import { notifyFollowersOfDone } from "@/lib/friend-done";
import { LIMITS } from "@/lib/limits";
import { MCP_LIMITS } from "@/lib/mcp/inputs";
import {
  BULK_TRANSACTION,
  MAX_DAYS_FROM_TODAY,
  MAX_EVENT_SPAN_DAYS,
  dayText,
  fail,
  ok,
  parseDay,
  pruneBatches,
  writeLimited,
  type McpContext,
  type ToolResult,
} from "@/lib/mcp/shared";
import { snapshotSchema } from "@/lib/mcp/snapshot";
import { restoreSnapshot } from "@/lib/mcp/undo";
import { prisma } from "@/lib/prisma";
import { settleSubTodos } from "@/lib/sub-todos";

/**
 * MCP 핵심 도구(읽기, 만들기, 끝내기, 옮기기, 되돌리기)가 하는 일. 서버 액션(app/(tabs)/actions.ts, events/actions.ts)과 같은 규칙(소유자 확인, 하루 상한,
 * 날짜 범위, 시각 검사)을 따른다. 서버 액션은 로그인 세션에 묶여 있어 그대로 부를 수 없어서 여기에 다시 적었다. 규칙을 바꿀 때는 두 곳을 같이 본다(docs/mcp.md).
 * 고치기·지우기·카테고리·루틴은 edit-tools.ts·organize-tools.ts, 프로필·설정·친구·반응은 people-tools.ts에 있다. 공용은 shared.ts.
 *
 * 모든 질의에 userId를 건다. id는 AI가 넘기는 값이라 믿지 않는다. 오류는 던지지 않고 isError 결과로 돌려줘서 AI가 읽고 고치게 한다.
 */

/** 한 번에 완료해도 친구에게 보내는 "끝냈어요" 알림은 이만큼까지만 보낸다. AI가 수십 개를 한꺼번에 끝내도 친구 폰이 울리지 않게 한다. */
const MAX_DONE_NOTIFICATIONS = 5;

export async function getOverview(ctx: McpContext): Promise<ToolResult> {
  const categories = await prisma.category.findMany({
    where: { userId: ctx.userId, archivedAt: null },
    orderBy: { order: "asc" },
    select: { id: true, name: true, color: true, isPublic: true },
  });
  return ok({
    today: dayText(todayIn(ctx.timezone)),
    timezone: ctx.timezone,
    // 이 토큰으로 할 수 있는 일. 목록에 보이는 도구와 같은 뜻이다(READ 읽기만, WRITE 만들기·끝내기·옮기기, FULL 고치기·지우기·설정·친구까지).
    access: { scope: ctx.scope, canReadFriends: ctx.allowFriends },
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      // 공개 카테고리의 할 일은 팔로워에게 보인다. 사용자가 비공개로 두라고 한 내용은 비공개 카테고리에 넣는다.
      visibleToFollowers: category.isPublic,
    })),
    limits: {
      todosPerDay: LIMITS.todosPerDay,
      eventsPerDay: LIMITS.eventsPerDay,
      events: LIMITS.events,
      todosPerCall: MCP_LIMITS.todosPerCall,
      eventsPerCall: MCP_LIMITS.eventsPerCall,
      idsPerCall: MCP_LIMITS.idsPerCall,
      maxDaysFromToday: MAX_DAYS_FROM_TODAY,
    },
  });
}

export async function listTodos(ctx: McpContext, input: { from: string; to?: string; includeMemo?: boolean }): Promise<ToolResult> {
  const from = parseDay(input.from);
  const to = input.to === undefined ? from : parseDay(input.to);
  if (!from || !to) return fail("'from' and 'to' must be real dates (YYYY-MM-DD).");
  const span = daysBetween(from, to);
  if (span < 0) return fail("'to' is before 'from'.");
  if (span > MCP_LIMITS.listDays) return fail(`List at most ${MCP_LIMITS.listDays} days at a time.`);

  const rows = await prisma.todo.findMany({
    where: { userId: ctx.userId, date: { gte: from, lte: to } },
    orderBy: [{ date: "asc" }, { order: "asc" }],
    take: MCP_LIMITS.listRows + 1,
    select: { id: true, date: true, content: true, done: true, memo: true, category: { select: { id: true, name: true } } },
  });
  const truncated = rows.length > MCP_LIMITS.listRows;
  return ok({
    from: dayText(from),
    to: dayText(to),
    truncated,
    // 루틴이 만드는 할 일은 그 날을 앱에서 열어야 생긴다. 안 연 날에는 아직 없을 수 있다.
    todos: rows.slice(0, MCP_LIMITS.listRows).map((todo) => ({
      id: todo.id,
      date: dayText(todo.date),
      content: todo.content,
      done: todo.done,
      category: todo.category ? { id: todo.category.id, name: todo.category.name } : null,
      ...(input.includeMemo && todo.memo ? { memo: todo.memo } : {}),
    })),
  });
}

type NewTodo = { content: string; date: string; category?: string; memo?: string };

export async function createTodos(ctx: McpContext, input: { todos: NewTodo[] }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;

  const today = todayIn(ctx.timezone);
  const categories = await prisma.category.findMany({
    where: { userId: ctx.userId, archivedAt: null },
    select: { id: true, name: true },
  });
  const byId = new Map(categories.map((category) => [category.id, category]));
  const byName = new Map(categories.map((category) => [category.name.trim().toLowerCase(), category]));

  const problems: string[] = [];
  const rows: { content: string; date: Date; categoryId: string | null; memo: string | null }[] = [];
  input.todos.forEach((item, index) => {
    const date = parseDay(item.date);
    if (!date) {
      problems.push(`todos[${index}].date is not a real date (YYYY-MM-DD).`);
      return;
    }
    if (Math.abs(daysBetween(today, date)) > MAX_DAYS_FROM_TODAY) {
      problems.push(`todos[${index}].date must be within ${MAX_DAYS_FROM_TODAY} days of today.`);
      return;
    }
    let categoryId: string | null = null;
    if (item.category) {
      const found = byId.get(item.category) ?? byName.get(item.category.trim().toLowerCase());
      if (!found) {
        problems.push(`todos[${index}].category "${item.category}" was not found. Available: ${categories.map((category) => category.name).join(", ") || "(none)"}.`);
        return;
      }
      categoryId = found.id;
    }
    rows.push({ content: item.content, date, categoryId, memo: item.memo ? item.memo : null });
  });
  if (problems.length > 0) return fail("Nothing was created.", { problems });

  // 하루 상한(서버 액션 addTodo와 같다)을 새로 만들 개수까지 합쳐서 본다.
  const days = [...new Set(rows.map((row) => dayText(row.date)))];
  const existing = await prisma.todo.groupBy({
    by: ["date"],
    where: { userId: ctx.userId, date: { in: days.map((day) => parseKSTDate(day)) } },
    _count: { _all: true },
    _max: { order: true },
  });
  const have = new Map(existing.map((row) => [dayText(row.date), row]));
  const adding = new Map<string, number>();
  for (const row of rows) adding.set(dayText(row.date), (adding.get(dayText(row.date)) ?? 0) + 1);
  for (const [day, count] of adding) {
    const current = have.get(day)?._count._all ?? 0;
    if (current + count > LIMITS.todosPerDay) {
      problems.push(`${day} already has ${current} todos; adding ${count} would exceed the limit of ${LIMITS.todosPerDay} per day.`);
    }
  }
  if (problems.length > 0) return fail("Nothing was created.", { problems });

  const nextOrder = new Map(days.map((day) => [day, (have.get(day)?._max.order ?? -1) + 1]));
  const { made, batch } = await prisma.$transaction(async (tx) => {
    const made: { id: string; date: Date; content: string }[] = [];
    for (const row of rows) {
      const day = dayText(row.date);
      const order = nextOrder.get(day) ?? 0;
      nextOrder.set(day, order + 1);
      made.push(
        // 메모는 AI가 쓴 것이라 팔로워에게 보이지 않게 둔다(memoPublic=false). 사용자가 앱에서 켜면 보인다.
        await tx.todo.create({
          data: { userId: ctx.userId, content: row.content, date: row.date, categoryId: row.categoryId, memo: row.memo, memoPublic: false, order },
          select: { id: true, date: true, content: true },
        }),
      );
    }
    const batch = await tx.mcpBatch.create({ data: { userId: ctx.userId, todoIds: made.map((todo) => todo.id) }, select: { id: true } });
    return { made, batch };
  }, BULK_TRANSACTION);
  await pruneBatches(ctx.userId);
  revalidatePath("/");

  return ok({
    batchId: batch.id,
    created: made.map((todo) => ({ id: todo.id, date: dayText(todo.date), content: todo.content })),
    undo: `Call undo_batch with this batchId within ${MCP_LIMITS.undoHours} hours to remove everything this call created (todos already marked done are kept).`,
  });
}

export async function completeTodos(ctx: McpContext, input: { ids: string[]; done?: boolean }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;

  const next = input.done !== false;
  const ids = [...new Set(input.ids)];
  const owned = await prisma.todo.findMany({ where: { id: { in: ids }, userId: ctx.userId }, select: { id: true, done: true } });
  const ownedIds = new Set(owned.map((todo) => todo.id));
  const toChange = owned.filter((todo) => todo.done !== next).map((todo) => todo.id);

  if (toChange.length > 0) {
    // 서버 액션 toggleTodo와 같다: 이미 그 상태인 것은 건드리지 않는다(완료 시각을 다시 찍으면 친구 목록의 순서가 바뀐다).
    await prisma.todo.updateMany({
      where: { id: { in: toChange }, userId: ctx.userId, done: !next },
      data: { done: next, doneAt: next ? new Date() : null },
    });
    if (next) {
      const doer = { id: ctx.userId, nickname: ctx.nickname };
      after(async () => {
        for (const todoId of toChange.slice(0, MAX_DONE_NOTIFICATIONS)) {
          await notifyFollowersOfDone(doer, todoId).catch((error) => console.error("[push] 끝냄 알림을 보내지 못했다.", error));
        }
      });
    }
  }
  revalidatePath("/");

  return ok({ changed: toChange.length, alreadyInThatState: owned.length - toChange.length, notFound: ids.filter((id) => !ownedIds.has(id)) });
}

export async function moveTodos(ctx: McpContext, input: { ids: string[]; date: string }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;

  const date = parseDay(input.date);
  if (!date) return fail("'date' must be a real date (YYYY-MM-DD).");
  if (Math.abs(daysBetween(todayIn(ctx.timezone), date)) > MAX_DAYS_FROM_TODAY) return fail(`'date' must be within ${MAX_DAYS_FROM_TODAY} days of today.`);

  const ids = [...new Set(input.ids)];
  const owned = await prisma.todo.findMany({ where: { id: { in: ids }, userId: ctx.userId }, select: { id: true, date: true, routineId: true } });
  const ownedIds = new Set(owned.map((todo) => todo.id));
  const moving = owned.filter((todo) => !isSameKSTDate(todo.date, date));
  if (moving.length === 0) {
    return ok({ moved: 0, alreadyThere: owned.length, notFound: ids.filter((id) => !ownedIds.has(id)) });
  }

  const count = await prisma.todo.count({ where: { userId: ctx.userId, date } });
  if (count + moving.length > LIMITS.todosPerDay) {
    return fail(`${dayText(date)} has ${count} todos; moving ${moving.length} more would exceed the limit of ${LIMITS.todosPerDay} per day.`);
  }
  const last = await prisma.todo.findFirst({ where: { userId: ctx.userId, date }, orderBy: { order: "desc" }, select: { order: true } });
  let order = (last?.order ?? -1) + 1;

  // 서버 액션 moveTodo와 같다: 루틴이 만든 할 일을 옮기면 그 날 루틴 할 일이 다시 생기지 않게 건너뛴 날로 남기고, 루틴과의 연결을 끊는다.
  const routineSkips = moving.flatMap((todo) => (todo.routineId ? [{ routineId: todo.routineId, date: todo.date }] : []));
  await prisma.$transaction([
    ...moving.map((todo) => prisma.todo.updateMany({ where: { id: todo.id, userId: ctx.userId }, data: { date, order: order++, routineId: null } })),
    ...(routineSkips.length > 0 ? [prisma.routineSkip.createMany({ data: routineSkips, skipDuplicates: true })] : []),
  ]);
  // 큰 할 일을 옮겼으면 안 끝낸 세부 할 일이 따라가고, 세부 할 일만 옮겼으면 연결이 끊긴다(lib/sub-todos.ts).
  await settleSubTodos(ctx.userId, moving.map((todo) => todo.id));
  revalidatePath("/");

  return ok({ moved: moving.length, to: dayText(date), alreadyThere: owned.length - moving.length, notFound: ids.filter((id) => !ownedIds.has(id)) });
}

export async function listEvents(ctx: McpContext, input: { from: string; to?: string }): Promise<ToolResult> {
  const from = parseDay(input.from);
  const to = input.to === undefined ? from : parseDay(input.to);
  if (!from || !to) return fail("'from' and 'to' must be real dates (YYYY-MM-DD).");
  const span = daysBetween(from, to);
  if (span < 0) return fail("'to' is before 'from'.");
  if (span > MCP_LIMITS.listDays) return fail(`List at most ${MCP_LIMITS.listDays} days at a time.`);

  const rows = await prisma.event.findMany({
    where: { userId: ctx.userId, startDate: { lte: to }, endDate: { gte: from } },
    orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
    take: MCP_LIMITS.listRows + 1,
    select: { id: true, title: true, startDate: true, endDate: true, startTime: true, endTime: true, color: true, isPublic: true },
  });
  const clock = (minutes: number | null) => (minutes === null ? null : formatTime(minutes));
  return ok({
    from: dayText(from),
    to: dayText(to),
    truncated: rows.length > MCP_LIMITS.listRows,
    events: rows.slice(0, MCP_LIMITS.listRows).map((event) => ({
      id: event.id,
      title: event.title,
      startDate: dayText(event.startDate),
      endDate: dayText(event.endDate),
      startTime: clock(event.startTime),
      endTime: clock(event.endTime),
      color: event.color,
      visibleToFollowers: event.isPublic,
    })),
  });
}

type NewEvent = {
  title: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  color?: string;
  memo?: string;
  isPublic?: boolean;
};

export async function createEvents(ctx: McpContext, input: { events: NewEvent[] }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;

  const problems: string[] = [];
  const rows: { title: string; startDate: Date; endDate: Date; startTime: number | null; endTime: number | null; color: string; memo: string | null; isPublic: boolean }[] = [];
  input.events.forEach((item, index) => {
    const startDate = parseDay(item.startDate);
    const endDate = item.endDate === undefined ? startDate : parseDay(item.endDate);
    if (!startDate || !endDate) {
      problems.push(`events[${index}] dates must be real dates (YYYY-MM-DD).`);
      return;
    }
    if (daysBetween(startDate, endDate) < 0) {
      problems.push(`events[${index}].endDate is before startDate.`);
      return;
    }
    if (daysBetween(startDate, endDate) > MAX_EVENT_SPAN_DAYS) {
      problems.push(`events[${index}] is longer than ${MAX_EVENT_SPAN_DAYS} days.`);
      return;
    }
    // 서버 액션 createEvent와 같은 시각 규칙: 끝 시간은 시작 시간이 있어야 하고, 같은 날이면 시작보다 빠를 수 없다.
    const startTime = parseTime(item.startTime ?? "");
    const endTime = parseTime(item.endTime ?? "");
    if (startTime === undefined || endTime === undefined) {
      problems.push(`events[${index}] times must be HH:MM.`);
      return;
    }
    if (startTime === null && endTime !== null) {
      problems.push(`events[${index}].endTime needs a startTime.`);
      return;
    }
    if (startTime !== null && endTime !== null && daysBetween(startDate, endDate) === 0 && endTime < startTime) {
      problems.push(`events[${index}].endTime is before startTime.`);
      return;
    }
    rows.push({
      title: item.title,
      startDate,
      endDate,
      startTime,
      endTime,
      color: item.color ? item.color.toLowerCase() : DEFAULT_EVENT_COLOR,
      memo: item.memo ? item.memo : null,
      isPublic: item.isPublic === true,
    });
  });
  if (problems.length > 0) return fail("Nothing was created.", { problems });

  const total = await prisma.event.count({ where: { userId: ctx.userId } });
  if (total + rows.length > LIMITS.events) return fail(`The limit is ${LIMITS.events} events in total (you have ${total}).`);

  // 하루 상한(서버 액션 createEvent와 같다)은 이번에 만드는 것끼리 겹치는 것까지 합쳐서 본다.
  const first = rows.reduce((min, row) => (row.startDate < min ? row.startDate : min), rows[0].startDate);
  const last = rows.reduce((max, row) => (row.endDate > max ? row.endDate : max), rows[0].endDate);
  const overlapping = await prisma.event.findMany({
    where: { userId: ctx.userId, startDate: { lte: last }, endDate: { gte: first } },
    select: { startDate: true, endDate: true },
  });
  const accepted = [...overlapping];
  rows.forEach((row, index) => {
    const full = firstOverfullDay(accepted, row.startDate, row.endDate, LIMITS.eventsPerDay);
    if (full) problems.push(`events[${index}]: ${dayText(full)} already has ${LIMITS.eventsPerDay} events, the limit per day.`);
    accepted.push({ startDate: row.startDate, endDate: row.endDate });
  });
  if (problems.length > 0) return fail("Nothing was created.", { problems });

  const { made, batch } = await prisma.$transaction(async (tx) => {
    const made: { id: string; title: string; startDate: Date; endDate: Date }[] = [];
    for (const row of rows) {
      // 팔로워에게 보이는 것은 사용자가 시킨 때만(isPublic=true). 메모는 늘 비공개로 둔다.
      made.push(await tx.event.create({ data: { userId: ctx.userId, ...row, memoPublic: false }, select: { id: true, title: true, startDate: true, endDate: true } }));
    }
    const batch = await tx.mcpBatch.create({ data: { userId: ctx.userId, eventIds: made.map((event) => event.id) }, select: { id: true } });
    return { made, batch };
  }, BULK_TRANSACTION);
  await pruneBatches(ctx.userId);
  revalidatePath("/");

  return ok({
    batchId: batch.id,
    created: made.map((event) => ({ id: event.id, title: event.title, startDate: dayText(event.startDate), endDate: dayText(event.endDate) })),
    undo: `Call undo_batch with this batchId within ${MCP_LIMITS.undoHours} hours to remove everything this call created.`,
  });
}

export async function undoBatch(ctx: McpContext, input: { batchId: string }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;

  const batch = await prisma.mcpBatch.findFirst({ where: { id: input.batchId, userId: ctx.userId } });
  if (!batch) return fail("Unknown batchId. It may be older than a week or from another call.");
  if (batch.createdAt.getTime() < Date.now() - MCP_LIMITS.undoHours * 3_600_000) {
    return fail(`This batch is older than ${MCP_LIMITS.undoHours} hours. Ask the user to delete the items in the app.`);
  }

  // 지우거나 고치기 전의 모습을 담은 묶음은 그 모습으로 되돌린다(lib/mcp/undo.ts). 한 번 쓴 묶음은 지운다.
  if (batch.snapshot !== null) {
    const parsed = snapshotSchema.safeParse(batch.snapshot);
    if (!parsed.success) {
      console.error("[mcp] 되돌리기 기록의 모양이 올바르지 않다.", batch.id);
      return fail("This batch record is damaged and cannot be undone. Ask the user to fix it in the app.");
    }
    const restored = await restoreSnapshot(ctx, parsed.data);
    if (!restored.isError) await prisma.mcpBatch.deleteMany({ where: { id: batch.id, userId: ctx.userId } });
    return restored;
  }

  // 사용자가 그 사이 끝낸 할 일은 사용자가 손댄 것이라 지우지 않는다.
  const [todos, events] = await prisma.$transaction([
    prisma.todo.deleteMany({ where: { id: { in: batch.todoIds }, userId: ctx.userId, done: false } }),
    prisma.event.deleteMany({ where: { id: { in: batch.eventIds }, userId: ctx.userId } }),
    prisma.mcpBatch.delete({ where: { id: batch.id } }),
  ]);
  revalidatePath("/");

  return ok({ deletedTodos: todos.count, deletedEvents: events.count, keptBecauseDone: batch.todoIds.length - todos.count });
}
