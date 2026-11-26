import { revalidatePath } from "next/cache";

import { isHexColor } from "@/lib/colors";
import { firstOverfullDay } from "@/lib/event-limit";
import { formatTime, parseTime } from "@/lib/event-time";
import { LIMITS } from "@/lib/limits";
import { MAX_MEMO_LENGTH } from "@/lib/memo";
import { MCP_LIMITS } from "@/lib/mcp/inputs";
import {
  BULK_TRANSACTION,
  dayText,
  eventShapeProblem,
  fail,
  ok,
  parseDay,
  pruneBatches,
  writeLimited,
  type McpContext,
  type ToolResult,
} from "@/lib/mcp/shared";
import type { EventSnapshotRow, Snapshot, TodoSnapshotRow } from "@/lib/mcp/snapshot";
import { prisma } from "@/lib/prisma";
import { settleSubTodos } from "@/lib/sub-todos";

/**
 * 모든 권한(FULL) 토큰의 고치기·지우기 도구(할 일·일정). 서버 액션(updateTodo, deleteTodo, updateEvent, deleteEvent)과 같은 규칙이고,
 * 서버 액션처럼 한 번에 한 개가 아니라 여러 개를 전부 아니면 무로 다룬다. 지우거나 고치기 전의 모습은 McpBatch.snapshot에 두어
 * undo_batch가 24시간 안에 되돌린다(lib/mcp/undo.ts).
 */
const undoNote = `Call undo_batch with this batchId within ${MCP_LIMITS.undoHours} hours to put things back.`;

type TodoUpdate = { id: string; content?: string; memo?: string | null; memoPublic?: boolean; category?: string };

export async function updateTodos(ctx: McpContext, input: { updates: TodoUpdate[] }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;

  const ids = input.updates.map((update) => update.id);
  if (new Set(ids).size !== ids.length) return fail("Each todo id may appear only once per call.");
  const [rows, categories] = await Promise.all([
    prisma.todo.findMany({ where: { id: { in: ids }, userId: ctx.userId } }),
    prisma.category.findMany({ where: { userId: ctx.userId, archivedAt: null }, select: { id: true, name: true } }),
  ]);
  const found = new Map(rows.map((row) => [row.id, row]));
  const byId = new Map(categories.map((category) => [category.id, category]));
  const byName = new Map(categories.map((category) => [category.name.trim().toLowerCase(), category]));

  const problems: string[] = [];
  const plan: { row: (typeof rows)[number]; data: Record<string, unknown> }[] = [];
  input.updates.forEach((update, index) => {
    const row = found.get(update.id);
    if (!row) {
      problems.push(`updates[${index}].id "${update.id}" was not found.`);
      return;
    }
    let categoryId: string | undefined;
    if (update.category !== undefined && row.parentId) {
      problems.push(`updates[${index}].category cannot be changed: "${update.id}" is a sub-todo and always uses its parent's category. Change the parent's category instead.`);
      return;
    }
    if (update.category !== undefined) {
      const category = byId.get(update.category) ?? byName.get(update.category.trim().toLowerCase());
      if (!category) {
        problems.push(`updates[${index}].category "${update.category}" was not found. Available: ${categories.map((each) => each.name).join(", ") || "(none)"}.`);
        return;
      }
      categoryId = category.id;
    }
    plan.push({
      row,
      data: {
        ...(update.content !== undefined && { content: update.content }),
        ...(update.memo !== undefined && { memo: update.memo ? update.memo : null }),
        ...(update.memoPublic !== undefined && { memoPublic: update.memoPublic }),
        // 서버 액션 updateTodo와 같다: 다른 카테고리로 옮기면 따로 고른 색은 버린다.
        ...(categoryId !== undefined && categoryId !== row.categoryId && { categoryId, color: null }),
      },
    });
  });
  if (problems.length > 0) return fail("Nothing was changed.", { problems });

  const snapshot: Snapshot = {
    kind: "todos-updated",
    rows: plan.map(({ row }) => ({ id: row.id, content: row.content, memo: row.memo, memoPublic: row.memoPublic, categoryId: row.categoryId, color: row.color })),
  };
  const batch = await prisma.$transaction(async (tx) => {
    for (const { row, data } of plan) await tx.todo.updateMany({ where: { id: row.id, userId: ctx.userId }, data });
    return tx.mcpBatch.create({ data: { userId: ctx.userId, snapshot }, select: { id: true } });
  }, BULK_TRANSACTION);
  // 카테고리를 옮긴 큰 할 일의 세부 할 일도 따라간다(세부 할 일은 큰 할 일과 같은 카테고리여야 친구에게 새지 않는다).
  await settleSubTodos(ctx.userId, plan.flatMap(({ row, data }) => ("categoryId" in data && data.categoryId !== row.categoryId ? [row.id] : [])));
  await pruneBatches(ctx.userId);
  revalidatePath("/");

  return ok({ batchId: batch.id, updated: plan.map(({ row }) => row.id), undo: undoNote });
}

/**
 * 이미 있는 할 일에 메모를 다는 도구(쓰기 토큰도 쓴다, 2026-11-17). 만들 때의 메모는 create_todos에 있지만, 있는 할 일에 메모를 다는 길은
 * update_todos(모든 권한)뿐이라 쓰기 토큰의 AI는 "메모를 못 넣는다"고 답했다. 메모만 다루고 글·카테고리는 건드리지 않는다.
 * 저장·되돌리기는 update_todos와 같은 길(snapshot)이다. 기본은 있던 메모 뒤에 줄을 바꿔 덧붙이고(사용자가 쓴 글을 덮지 않는다),
 * AI가 쓴 메모는 만들 때처럼 팔로워에게 보이지 않게 둔다(memoPublic=false). 있던 메모가 공개였다면 그것도 비공개가 된다(사용자가 앱에서 다시 켠다).
 */
export async function addTodoMemos(ctx: McpContext, input: { memos: { id: string; memo: string }[]; replace?: boolean }): Promise<ToolResult> {
  const ids = [...new Set(input.memos.map((item) => item.id))];
  const rows = await prisma.todo.findMany({ where: { id: { in: ids }, userId: ctx.userId }, select: { id: true, memo: true } });
  const current = new Map(rows.map((row) => [row.id, row.memo]));

  const problems: string[] = [];
  const updates = input.memos.map((item, index) => {
    const existing = current.get(item.id);
    const memo = !input.replace && existing ? `${existing}\n${item.memo}` : item.memo;
    if (memo.length > MAX_MEMO_LENGTH) problems.push(`memos[${index}] would make the note ${memo.length} characters long; the limit is ${MAX_MEMO_LENGTH}. Shorten it or set replace=true.`);
    return { id: item.id, memo, memoPublic: false };
  });
  if (problems.length > 0) return fail("Nothing was changed.", { problems });
  // 없는 id·같은 id 두 번은 updateTodos가 같은 문장으로 막고, 요청 속도 제한도 거기서 센다.
  return updateTodos(ctx, { updates });
}

const todoRow = (row: {
  id: string;
  content: string;
  date: Date;
  done: boolean;
  doneAt: Date | null;
  order: number;
  categoryId: string | null;
  color: string | null;
  routineId: string | null;
  memo: string | null;
  memoPublic: boolean;
  parentId: string | null;
  createdAt: Date;
}): TodoSnapshotRow => ({
  id: row.id,
  content: row.content,
  date: dayText(row.date),
  done: row.done,
  doneAt: row.doneAt?.toISOString() ?? null,
  order: row.order,
  categoryId: row.categoryId,
  color: row.color,
  routineId: row.routineId,
  memo: row.memo,
  memoPublic: row.memoPublic,
  parentId: row.parentId,
  createdAt: row.createdAt.toISOString(),
});

export async function deleteTodos(ctx: McpContext, input: { ids: string[] }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;

  const ids = [...new Set(input.ids)];
  const asked = await prisma.todo.findMany({ where: { id: { in: ids }, userId: ctx.userId } });
  const foundIds = new Set(asked.map((row) => row.id));
  const notFound = ids.filter((id) => !foundIds.has(id));
  if (asked.length === 0) return ok({ deleted: 0, notFound });
  // 큰 할 일을 지우면 그 밑의 세부 할 일도 같이 지운다(앱의 deleteTodo와 같다, 2026-11-20). undo_batch가 함께 되살린다.
  const kids = await prisma.todo.findMany({ where: { parentId: { in: [...foundIds] }, id: { notIn: [...foundIds] }, userId: ctx.userId } });
  const rows = [...asked, ...kids];
  const allIds = rows.map((row) => row.id);

  // 서버 액션 deleteTodo와 같다: 루틴이 만든 할 일이면 그 날을 건너뛴다고 남긴다. 남기지 않으면 화면을 다시 그릴 때 "없으니 만든다"가 돌아 되살아난다.
  const skips = rows.flatMap((row) => (row.routineId ? [{ routineId: row.routineId, date: row.date }] : []));
  const batch = await prisma.$transaction(async (tx) => {
    await tx.todo.deleteMany({ where: { id: { in: allIds }, userId: ctx.userId } });
    if (skips.length > 0) await tx.routineSkip.createMany({ data: skips, skipDuplicates: true });
    return tx.mcpBatch.create({ data: { userId: ctx.userId, snapshot: { kind: "todos-deleted", rows: rows.map(todoRow) } satisfies Snapshot }, select: { id: true } });
  }, BULK_TRANSACTION);
  await pruneBatches(ctx.userId);
  revalidatePath("/");

  return ok({
    batchId: batch.id,
    deleted: rows.length,
    notFound,
    ...(kids.length > 0 ? { subTodosDeletedAlong: kids.length } : {}),
    undo: `${undoNote} Reactions friends sent to these todos cannot be restored.`,
  });
}

type EventUpdate = {
  id: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string | null;
  endTime?: string | null;
  color?: string;
  // 내 색(이름 붙은 색)의 id나 이름. null이면 떼고 색은 남긴다(2026-11-26).
  category?: string | null;
  memo?: string | null;
  isPublic?: boolean;
  memoPublic?: boolean;
  dday?: boolean;
};

type EventRow = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  startTime: number | null;
  endTime: number | null;
  color: string;
  categoryId: string | null;
  memo: string | null;
  dday: boolean;
  isPublic: boolean;
  memoPublic: boolean;
  sortOrder: number;
  createdAt: Date;
};

const eventSnapshot = (row: EventRow): EventSnapshotRow => ({
  id: row.id,
  title: row.title,
  startDate: dayText(row.startDate),
  endDate: dayText(row.endDate),
  startTime: row.startTime,
  endTime: row.endTime,
  color: row.color,
  categoryId: row.categoryId,
  memo: row.memo,
  dday: row.dday,
  isPublic: row.isPublic,
  memoPublic: row.memoPublic,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt.toISOString(),
});

/** 이번 고치기에 내 색(category)을 건드리는 항목이 있는가. 없으면 목록을 읽지 않는다. */
function touchesNamedColor(updates: EventUpdate[]): boolean {
  return updates.some((update) => typeof update.category === "string");
}

export async function updateEvents(ctx: McpContext, input: { updates: EventUpdate[] }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;

  const ids = input.updates.map((update) => update.id);
  if (new Set(ids).size !== ids.length) return fail("Each event id may appear only once per call.");
  const rows = await prisma.event.findMany({ where: { id: { in: ids }, userId: ctx.userId } });
  const found = new Map(rows.map((row) => [row.id, row]));
  // 내 색(이름 붙은 색)은 한 번에 읽어 둔다. id나 이름(대소문자 무시)으로 찾는다.
  const namedColors = touchesNamedColor(input.updates) ? await prisma.eventCategory.findMany({ where: { userId: ctx.userId }, orderBy: { order: "asc" }, select: { id: true, name: true, color: true } }) : [];

  const problems: string[] = [];
  const plan: { before: EventRow; after: Omit<EventRow, "id" | "sortOrder" | "createdAt"> }[] = [];
  input.updates.forEach((update, index) => {
    const row = found.get(update.id);
    if (!row) {
      problems.push(`updates[${index}].id "${update.id}" was not found.`);
      return;
    }
    const startDate = update.startDate === undefined ? row.startDate : parseDay(update.startDate);
    const endDate = update.endDate === undefined ? row.endDate : parseDay(update.endDate);
    if (!startDate || !endDate) {
      problems.push(`updates[${index}] dates must be real dates (YYYY-MM-DD).`);
      return;
    }
    // 시작 시각을 지우면(하루 종일) 끝 시각도 같이 지운다. 끝 시각만 남은 일정은 없다.
    const startTime = update.startTime === undefined ? row.startTime : update.startTime === null ? null : parseTime(update.startTime);
    const parsedEnd = update.endTime === undefined ? row.endTime : update.endTime === null ? null : parseTime(update.endTime);
    if (startTime === undefined || parsedEnd === undefined) {
      problems.push(`updates[${index}] times must be HH:MM.`);
      return;
    }
    const endTime = update.endTime === undefined && startTime === null ? null : parsedEnd;
    const shape = eventShapeProblem({ startDate, endDate, startTime, endTime });
    if (shape) {
      problems.push(`updates[${index}]: ${shape}`);
      return;
    }
    if (update.color !== undefined && !isHexColor(update.color)) {
      problems.push(`updates[${index}].color must be #rrggbb.`);
      return;
    }
    // 내 색: 고르면 그 색과 이름이 붙고, null이면 이름만 떼며, 색을 손으로 바꾸면 이름도 뗀다(앱의 "직접 고르기"와 같다).
    if (update.category !== undefined && update.color !== undefined) {
      problems.push(`updates[${index}]: give either color or category, not both.`);
      return;
    }
    let color = update.color ? update.color.toLowerCase() : row.color;
    let categoryId = row.categoryId;
    if (update.category === null) {
      categoryId = null;
    } else if (typeof update.category === "string") {
      const wanted = update.category.trim().toLowerCase();
      const named = namedColors.find((each) => each.id === update.category) ?? namedColors.find((each) => each.name.trim().toLowerCase() === wanted);
      if (!named) {
        problems.push(`updates[${index}].category "${update.category}" was not found. Available: ${namedColors.map((each) => each.name).join(", ") || "(none)"}.`);
        return;
      }
      categoryId = named.id;
      color = named.color;
    } else if (update.color !== undefined) {
      categoryId = null;
    }
    const isPublic = update.isPublic ?? row.isPublic;
    plan.push({
      before: row,
      after: {
        title: update.title ?? row.title,
        startDate,
        endDate,
        startTime,
        endTime,
        color,
        categoryId,
        memo: update.memo === undefined ? row.memo : update.memo ? update.memo : null,
        dday: update.dday ?? row.dday,
        isPublic,
        // 일정을 숨기면 메모도 같이 숨는다(서버 액션 updateEvent와 같다).
        memoPublic: isPublic && (update.memoPublic ?? row.memoPublic),
      },
    });
  });
  if (problems.length > 0) return fail("Nothing was changed.", { problems });

  // 하루 상한은 고치는 일정끼리 서로 겹치는 것까지 합쳐서, 고치지 않는 일정과 함께 센다.
  const first = plan.reduce((min, { after }) => (after.startDate < min ? after.startDate : min), plan[0].after.startDate);
  const last = plan.reduce((max, { after }) => (after.endDate > max ? after.endDate : max), plan[0].after.endDate);
  const accepted = await prisma.event.findMany({
    where: { userId: ctx.userId, id: { notIn: ids }, startDate: { lte: last }, endDate: { gte: first } },
    select: { startDate: true, endDate: true },
  });
  plan.forEach(({ after }, index) => {
    const full = firstOverfullDay(accepted, after.startDate, after.endDate, LIMITS.eventsPerDay);
    if (full) problems.push(`updates[${index}]: ${dayText(full)} already has ${LIMITS.eventsPerDay} events, the limit per day.`);
    accepted.push({ startDate: after.startDate, endDate: after.endDate });
  });
  if (problems.length > 0) return fail("Nothing was changed.", { problems });

  const batch = await prisma.$transaction(async (tx) => {
    for (const { before, after } of plan) await tx.event.updateMany({ where: { id: before.id, userId: ctx.userId }, data: after });
    return tx.mcpBatch.create({
      data: { userId: ctx.userId, snapshot: { kind: "events-updated", rows: plan.map(({ before }) => eventSnapshot(before)) } satisfies Snapshot },
      select: { id: true },
    });
  }, BULK_TRANSACTION);
  await pruneBatches(ctx.userId);
  revalidatePath("/");

  return ok({
    batchId: batch.id,
    updated: plan.map(({ before, after }) => ({
      id: before.id,
      title: after.title,
      startDate: dayText(after.startDate),
      endDate: dayText(after.endDate),
      startTime: after.startTime === null ? null : formatTime(after.startTime),
      endTime: after.endTime === null ? null : formatTime(after.endTime),
    })),
    undo: undoNote,
  });
}

export async function deleteEvents(ctx: McpContext, input: { ids: string[] }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;

  const ids = [...new Set(input.ids)];
  const rows = await prisma.event.findMany({ where: { id: { in: ids }, userId: ctx.userId } });
  const foundIds = new Set(rows.map((row) => row.id));
  const notFound = ids.filter((id) => !foundIds.has(id));
  if (rows.length === 0) return ok({ deleted: 0, notFound });

  const batch = await prisma.$transaction(async (tx) => {
    await tx.event.deleteMany({ where: { id: { in: [...foundIds] }, userId: ctx.userId } });
    return tx.mcpBatch.create({ data: { userId: ctx.userId, snapshot: { kind: "events-deleted", rows: rows.map(eventSnapshot) } satisfies Snapshot }, select: { id: true } });
  }, BULK_TRANSACTION);
  await pruneBatches(ctx.userId);
  revalidatePath("/");

  return ok({ batchId: batch.id, deleted: rows.length, notFound, undo: undoNote });
}
