"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AI_CONSENT_VALID_FROM } from "@/lib/ai/consent";
import { AI_LIMITS } from "@/lib/ai/plan";
import { MCP_LIMITS } from "@/lib/mcp/inputs";
import { type McpContext } from "@/lib/mcp/shared";
import { createEvents, createTodos, undoBatch } from "@/lib/mcp/tools";
import { isId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/**
 * AI 도우미의 서버 동작(2026-11-17). 동의를 적고, 사용자가 미리보기에서 확인한 제안을 저장하고, 방금 넣은 것을 되돌린다.
 * 저장은 AI 연결(MCP)의 만들기 도구(lib/mcp/tools.ts)를 그대로 쓴다: 하루 상한·날짜 범위·시각 규칙이 같고, 전부 되거나 하나도 안 되며,
 * 일정은 기본 비공개이고, 되돌리기(묶음)가 생긴다. 브라우저가 보낸 값은 믿지 않고 여기서 다시 검사한다.
 */
export async function acceptAiChatConsent(): Promise<void> {
  const user = await requireUser();
  // 지금 문구에 이미 동의한 사람의 시각은 덮어쓰지 않는다. 받는 곳이 바뀌기 전(AI_CONSENT_VALID_FROM 전)의 동의는 새로 받는다.
  await prisma.user.updateMany({
    where: { id: user.id, OR: [{ aiChatConsentAt: null }, { aiChatConsentAt: { lt: AI_CONSENT_VALID_FROM } }] },
    data: { aiChatConsentAt: new Date() },
  });
  revalidatePath("/ai");
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const planSchema = z.object({
  todos: z
    .array(
      z.object({
        content: z.string().trim().min(1).max(200),
        date: day,
        category: z.string().trim().min(1).max(64).nullable(),
        // 이 할 일 밑에 달 세부 할 일의 제목들(2026-11-20). 저장할 때 큰 할 일을 먼저 만들고 그 id로 이어서 만든다.
        subTodos: z.array(z.string().trim().min(1).max(200)).max(AI_LIMITS.subTodosPerTodo).optional(),
      }),
    )
    .max(MCP_LIMITS.todosPerCall)
    .refine((todos) => todos.reduce((sum, todo) => sum + (todo.subTodos?.length ?? 0), 0) <= AI_LIMITS.subTodos),
  events: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(100),
        startDate: day,
        endDate: day,
        startTime: time.nullable(),
        endTime: time.nullable(),
      }),
    )
    .max(MCP_LIMITS.eventsPerCall),
});

export type ApplyResult = { ok: true; todos: number; subTodos: number; events: number; batchIds: string[] } | { ok: false; reason: "invalid" | "rejected" | "partial"; batchIds: string[] };

/** 도구가 돌려준 글(JSON)에서 묶음 번호와 만든 것의 id(입력 순서대로)를 꺼낸다. 실패하면 null. */
function readResult(result: { isError?: boolean; content: { text: string }[] }): { batchId: string; count: number; ids: string[] } | null {
  if (result.isError) return null;
  try {
    const data = JSON.parse(result.content[0]?.text ?? "{}") as { batchId?: unknown; created?: { id?: unknown }[] };
    const ids = Array.isArray(data.created) ? data.created.flatMap((item) => (typeof item?.id === "string" ? [item.id] : [])) : [];
    return typeof data.batchId === "string" ? { batchId: data.batchId, count: ids.length, ids } : null;
  } catch (error) {
    console.error("[ai] 저장 결과를 읽지 못했다.", error instanceof Error ? error.name : error);
    return null;
  }
}

export async function applyAiPlan(input: unknown): Promise<ApplyResult> {
  const user = await requireUser();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success || (parsed.data.todos.length === 0 && parsed.data.events.length === 0)) return { ok: false, reason: "invalid", batchIds: [] };

  // 도구는 AI 연결 토큰을 위한 것이라 같은 모양의 값을 넘긴다. 토큰이 아니므로 번호는 이 기능 전용 이름이다(속도 제한의 열쇠로만 쓴다).
  const ctx: McpContext = { userId: user.id, nickname: user.nickname, timezone: user.timezone, tokenId: `ai-chat:${user.id}`, scope: "WRITE", allowFriends: false };
  const batchIds: string[] = [];
  let todos = 0;
  let subTodos = 0;
  let events = 0;

  if (parsed.data.todos.length > 0) {
    const made = readResult(
      await createTodos(ctx, { todos: parsed.data.todos.map((todo) => ({ content: todo.content, date: todo.date, ...(todo.category ? { category: todo.category } : {}) })) }),
    );
    if (!made) return { ok: false, reason: "rejected", batchIds };
    batchIds.push(made.batchId);
    todos = made.count;

    // 세부 할 일은 방금 만든 큰 할 일의 id로 이어서 만든다(입력 순서와 같다). 못 만들면 큰 할 일도 거둔다: 반쪽만 남기지 않는다(2026-11-20).
    const children = parsed.data.todos.flatMap((todo, index) => (made.ids[index] ? (todo.subTodos ?? []).map((content) => ({ content, parentId: made.ids[index] })) : []));
    if (children.length > 0) {
      const madeChildren = readResult(await createTodos(ctx, { todos: children }));
      if (!madeChildren) {
        await undoBatch(ctx, { batchId: made.batchId });
        revalidatePath("/");
        return { ok: false, reason: "rejected", batchIds: [] };
      }
      batchIds.push(madeChildren.batchId);
      subTodos = madeChildren.count;
    }
  }
  if (parsed.data.events.length > 0) {
    const made = readResult(
      await createEvents(ctx, {
        events: parsed.data.events.map((event) => ({
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          ...(event.startTime ? { startTime: event.startTime } : {}),
          ...(event.startTime && event.endTime ? { endTime: event.endTime } : {}),
        })),
      }),
    );
    // 할 일은 이미 들어갔다. 일정만 못 넣었으면 그 사실과 할 일의 되돌리기 번호를 알린다.
    if (!made) return { ok: false, reason: "partial", batchIds };
    batchIds.push(made.batchId);
    events = made.count;
  }
  revalidatePath("/");
  return { ok: true, todos, subTodos, events, batchIds };
}

/** 방금 넣은 것을 되돌린다(AI 연결의 되돌리기와 같다: 24시간 안, 그새 끝낸 할 일은 남긴다). */
export async function undoAiPlan(batchIds: string[]): Promise<{ ok: boolean }> {
  const user = await requireUser();
  // 할 일·세부 할 일·일정, 많아야 셋이다.
  if (!Array.isArray(batchIds) || batchIds.length === 0 || batchIds.length > 3 || !batchIds.every(isId)) return { ok: false };
  const ctx: McpContext = { userId: user.id, nickname: user.nickname, timezone: user.timezone, tokenId: `ai-chat:${user.id}`, scope: "WRITE", allowFriends: false };
  let ok = true;
  // 늦게 만든 것부터 되돌린다(세부 할 일을 먼저 지우고 큰 할 일을 지운다).
  for (const batchId of [...batchIds].reverse()) {
    const result = await undoBatch(ctx, { batchId });
    if (result.isError) ok = false;
  }
  revalidatePath("/");
  return { ok };
}
