"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AI_CONSENT_VALID_FROM } from "@/lib/ai/consent";
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
    .array(z.object({ content: z.string().trim().min(1).max(200), date: day, category: z.string().trim().min(1).max(64).nullable() }))
    .max(MCP_LIMITS.todosPerCall),
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

export type ApplyResult = { ok: true; todos: number; events: number; batchIds: string[] } | { ok: false; reason: "invalid" | "rejected" | "partial"; batchIds: string[] };

/** 도구가 돌려준 글(JSON)에서 묶음 번호와 개수를 꺼낸다. 실패하면 null. */
function readResult(result: { isError?: boolean; content: { text: string }[] }): { batchId: string; count: number } | null {
  if (result.isError) return null;
  try {
    const data = JSON.parse(result.content[0]?.text ?? "{}") as { batchId?: unknown; created?: unknown[] };
    return typeof data.batchId === "string" ? { batchId: data.batchId, count: Array.isArray(data.created) ? data.created.length : 0 } : null;
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
  let events = 0;

  if (parsed.data.todos.length > 0) {
    const made = readResult(
      await createTodos(ctx, { todos: parsed.data.todos.map((todo) => ({ content: todo.content, date: todo.date, ...(todo.category ? { category: todo.category } : {}) })) }),
    );
    if (!made) return { ok: false, reason: "rejected", batchIds };
    batchIds.push(made.batchId);
    todos = made.count;
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
  return { ok: true, todos, events, batchIds };
}

/** 방금 넣은 것을 되돌린다(AI 연결의 되돌리기와 같다: 24시간 안, 그새 끝낸 할 일은 남긴다). */
export async function undoAiPlan(batchIds: string[]): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!Array.isArray(batchIds) || batchIds.length === 0 || batchIds.length > 2 || !batchIds.every(isId)) return { ok: false };
  const ctx: McpContext = { userId: user.id, nickname: user.nickname, timezone: user.timezone, tokenId: `ai-chat:${user.id}`, scope: "WRITE", allowFriends: false };
  let ok = true;
  for (const batchId of batchIds) {
    const result = await undoBatch(ctx, { batchId });
    if (result.isError) ok = false;
  }
  revalidatePath("/");
  return { ok };
}
