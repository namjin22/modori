import { z } from "zod";

import { askGemini, isGeminiConfigured, type GeminiMessage } from "@/lib/ai/gemini";
import { takeAiChat } from "@/lib/ai/limit";
import { AI_LIMITS, buildContext, buildSystemPrompt, hasUnsafeHealthPlan, parseReply, recentMessages, type AiPlan } from "@/lib/ai/plan";
import { endOfMonthKST, formatKST, startOfMonthKST, todayIn } from "@/lib/date";
import { formatTime } from "@/lib/event-time";
import { aichat } from "@/lib/i18n/messages/aichat";
import { getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 80_000;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(5000) }))
    .min(1)
    .max(60),
});

export type ChatError = "login" | "bad-request" | "consent" | "not-configured" | "busy" | "limit-burst" | "limit-day" | "blocked" | "unavailable" | "format" | "server";
/** `code`는 원인을 가리키는 짧은 영문 표시(예: http-404-NOT_FOUND)로, 대화창에 그대로 보인다. 키·보낸 말은 들어 있지 않다. */
export type ChatResponse = ({ ok: true } & AiPlan) | { ok: false; error: ChatError; code?: string; retryAfter?: number };

function reply(body: ChatResponse, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * AI 도우미의 대화 한 번(2026-11-17, docs/decisions.md). 브라우저가 지금까지의 대화를 보내면(서버는 대화를 저장하지 않는다),
 * 내 이번 달 할 일·일정(제목·날짜·시각·카테고리 이름, 메모 제외)과 함께 Google Gemini에 보내 답과 제안을 받는다. 제안은 저장하지 않는다:
 * 사용자가 미리보기를 확인하고 누르면 서버 액션(app/(tabs)/ai/actions.ts)이 규칙을 다시 검사해 저장한다.
 * 쿠키 세션은 SameSite=Lax라 다른 사이트에서 이 POST를 대신 보낼 수 없다.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    return await handle(request);
  } catch (error) {
    // 예상하지 못한 오류도 JSON으로 돌려 화면이 이유를 보이게 한다(예전에는 HTML 오류 쪽이 가서 "보내지 못했어요"만 나왔다).
    const name = error instanceof Error ? error.name : "unknown";
    console.error("[ai] 대화를 처리하지 못했다.", name, error instanceof Error ? error.message.slice(0, 200) : "");
    return reply({ ok: false, error: "server", code: `server-${name}` });
  }
}

async function handle(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user?.nickname) return reply({ ok: false, error: "login" }, 401);

  // 동의 없이는 내 데이터가 나가지 않는다.
  const consent = await prisma.user.findUnique({ where: { id: user.id }, select: { aiChatConsentAt: true } });
  if (!consent?.aiChatConsentAt) return reply({ ok: false, error: "consent" }, 403);
  // 아래 "서비스 쪽 실패"(설정 안 됨·AI 연결 실패·답 형식 불량)는 502·503이 아니라 200에 ok:false로 돌려준다. 앞단(Cloudflare)은
  // 원서버의 502·504 본문을 자기 오류 화면으로 바꿔 버릴 수 있고, 그러면 브라우저가 이유(JSON)를 읽지 못해 "보내지 못했어요"만 보인다.
  if (!isGeminiConfigured()) return reply({ ok: false, error: "not-configured", code: "no-key" });

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return reply({ ok: false, error: "bad-request" }, 413);
  let body: z.infer<typeof bodySchema>;
  try {
    const parsed = bodySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return reply({ ok: false, error: "bad-request" }, 400);
    body = parsed.data;
  } catch (error) {
    console.warn("[ai] 요청 본문이 JSON이 아니다.", error instanceof Error ? error.name : error);
    return reply({ ok: false, error: "bad-request" }, 400);
  }
  const messages = recentMessages(body.messages);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") return reply({ ok: false, error: "bad-request" }, 400);

  const limit = takeAiChat(user.id, user.timezone);
  if (!limit.ok) return reply({ ok: false, error: limit.reason === "day" ? "limit-day" : "limit-burst", retryAfter: limit.retryAfter }, 429);

  // 이번 달(내 시간대)의 할 일·일정. 메모는 고르지 않는다.
  const today = todayIn(user.timezone);
  const monthStart = startOfMonthKST(today);
  const monthEnd = endOfMonthKST(today);
  const [categories, todos, events] = await Promise.all([
    prisma.category.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: { order: "asc" }, select: { name: true } }),
    prisma.todo.findMany({
      where: { userId: user.id, date: { gte: monthStart, lte: monthEnd } },
      orderBy: [{ date: "asc" }, { order: "asc" }],
      take: AI_LIMITS.contextTodos,
      select: { date: true, content: true, done: true, category: { select: { name: true } } },
    }),
    prisma.event.findMany({
      where: { userId: user.id, startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
      orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
      take: AI_LIMITS.contextEvents,
      select: { title: true, startDate: true, endDate: true, startTime: true, endTime: true },
    }),
  ]);
  const categoryNames = categories.map((category) => category.name);

  const system = buildSystemPrompt({
    today: formatKST(today),
    timezone: user.timezone,
    context: buildContext({
      categories: categoryNames,
      todos: todos.map((todo) => ({ date: todo.date, content: todo.content, done: todo.done, category: todo.category?.name ?? null })),
      events: events.map((event) => ({
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        startTime: event.startTime === null ? null : formatTime(event.startTime),
        endTime: event.endTime === null ? null : formatTime(event.endTime),
      })),
    }),
  });
  const contents: GeminiMessage[] = messages.map((message) => ({ role: message.role === "user" ? "user" : "model", text: message.text }));

  const answer = await askGemini({ system, messages: contents });
  if (!answer.ok) {
    if (answer.kind === "busy") return reply({ ok: false, error: "busy", code: answer.code }, 429);
    if (answer.kind === "blocked") return reply({ ok: false, error: "blocked", code: answer.code });
    return reply({ ok: false, error: "unavailable", code: answer.code });
  }

  const plan = parseReply(answer.text, { today, categories: categoryNames });
  if (!plan) return reply({ ok: false, error: "format", code: "reply-not-plan" });

  // 마지막 안전망: 몸에 해로운 표현이 제안 글에 있으면 제안을 통째로 버리고 고정 안내로 바꾼다.
  if (hasUnsafeHealthPlan(plan)) {
    const t = await getT(aichat);
    return reply({ ok: true, reply: t("unsafeReply"), declined: true, todos: [], events: [] });
  }
  return reply({ ok: true, ...plan });
}
