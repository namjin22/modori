import { z } from "zod";

/**
 * AI가 지우거나 고치기 전의 모습. "방금 한 것 되돌리기"(undo_batch)가 쓰며 McpBatch.snapshot에 JSON으로 24시간(기록은 7일) 둔다.
 * DB에서 읽은 값도 믿지 않고 다시 검사한다(모양이 틀리면 되돌리지 않고 오류로 답한다).
 * 날짜는 "YYYY-MM-DD", 시각은 ISO 문자열이다(JSON에는 Date가 없다).
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const instant = z.string();
const id = z.string().min(1).max(64);
const freq = z.enum(["DAILY", "WEEKLY", "MONTHLY"]);

const todoRow = z.object({
  id,
  content: z.string(),
  date: day,
  done: z.boolean(),
  doneAt: instant.nullable(),
  order: z.number().int(),
  categoryId: id.nullable(),
  color: z.string().nullable(),
  routineId: id.nullable(),
  memo: z.string().nullable(),
  memoPublic: z.boolean(),
  // 세부 할 일이었으면 큰 할 일의 id(2026-11-20). 그 전에 만든 기록에는 없다.
  parentId: id.nullable().optional(),
  createdAt: instant,
});

/** update_todos가 바꾸기 전의 칸들. */
const todoBefore = z.object({
  id,
  content: z.string(),
  memo: z.string().nullable(),
  memoPublic: z.boolean(),
  categoryId: id.nullable(),
  color: z.string().nullable(),
});

const eventRow = z.object({
  id,
  title: z.string(),
  startDate: day,
  endDate: day,
  startTime: z.number().int().nullable(),
  endTime: z.number().int().nullable(),
  color: z.string(),
  memo: z.string().nullable(),
  dday: z.boolean(),
  isPublic: z.boolean(),
  memoPublic: z.boolean(),
  sortOrder: z.number().int(),
  // 내 색(이름 붙은 색)을 골랐던 일정이면 그 id(2026-11-26). 그 전에 만든 기록에는 없다.
  categoryId: id.nullable().optional(),
  createdAt: instant,
});

const routineRow = z.object({
  id,
  content: z.string(),
  freq,
  byWeekday: z.array(z.number().int()),
  byMonthday: z.array(z.number().int()),
  categoryId: id.nullable(),
  startDate: day,
  endDate: day.nullable(),
  paused: z.boolean(),
  order: z.number().int(),
  // 루틴을 지우면 할 일의 routineId가 비워진다. 되돌릴 때 다시 이어 붙인다.
  todoIds: z.array(id),
  skipDates: z.array(day),
});

const eventRoutineRow = z.object({
  id,
  title: z.string(),
  color: z.string(),
  startTime: z.number().int().nullable(),
  endTime: z.number().int().nullable(),
  freq,
  byWeekday: z.array(z.number().int()),
  byMonthday: z.array(z.number().int()),
  startDate: day,
  endDate: day.nullable(),
  paused: z.boolean(),
  isPublic: z.boolean(),
  categoryId: id.nullable().optional(),
  skipDates: z.array(day),
});

/** 내 색(이름 붙은 색)을 지우기 전의 모습. 붙어 있던 일정·반복 일정의 id를 담아 되돌릴 때 다시 잇는다. */
const eventCategoryRow = z.object({
  id,
  name: z.string(),
  color: z.string(),
  order: z.number().int(),
  eventIds: z.array(id),
  routineIds: z.array(id),
});

const categoryRow = z.object({
  id,
  name: z.string(),
  color: z.string(),
  isPublic: z.boolean(),
  order: z.number().int(),
  todoIds: z.array(id),
  routineIds: z.array(id),
  // 지울 때 멈춘 루틴. 되돌릴 때 이것만 다시 켠다. 원래 멈춰 있던 루틴은 그대로 둔다.
  pausedRoutineIds: z.array(id),
});

export const snapshotSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("todos-deleted"), rows: z.array(todoRow) }),
  z.object({ kind: z.literal("todos-updated"), rows: z.array(todoBefore) }),
  z.object({ kind: z.literal("events-deleted"), rows: z.array(eventRow) }),
  z.object({ kind: z.literal("events-updated"), rows: z.array(eventRow) }),
  z.object({ kind: z.literal("category-deleted"), category: categoryRow }),
  z.object({ kind: z.literal("event-category-deleted"), category: eventCategoryRow }),
  z.object({ kind: z.literal("routine-deleted"), routine: routineRow }),
  z.object({ kind: z.literal("event-routine-deleted"), routine: eventRoutineRow }),
]);

export type Snapshot = z.infer<typeof snapshotSchema>;
export type TodoSnapshotRow = z.infer<typeof todoRow>;
export type EventSnapshotRow = z.infer<typeof eventRow>;
export type RoutineSnapshotRow = z.infer<typeof routineRow>;
export type EventRoutineSnapshotRow = z.infer<typeof eventRoutineRow>;
