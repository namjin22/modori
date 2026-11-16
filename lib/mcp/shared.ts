import { parseKSTDate, formatKST, daysBetween } from "@/lib/date";
import { MCP_LIMITS } from "@/lib/mcp/inputs";
import { prisma } from "@/lib/prisma";
import { take, type RateRule } from "@/lib/rate-limit";

/**
 * MCP 도구들이 같이 쓰는 것. 도구는 영역별 파일(tools.ts 핵심, edit-tools.ts 고치기·지우기, organize-tools.ts 카테고리·루틴,
 * people-tools.ts 프로필·설정·친구·반응)에 나뉘어 있고, 결과 모양·속도 제한·날짜 읽기는 여기서 하나로 둔다.
 *
 * 토큰의 권한: READ는 읽기만, WRITE는 만들기·끝내기·옮기기·되돌리기, FULL은 거기에 고치기·지우기·카테고리·루틴·프로필·설정·친구·반응을 더한다.
 * 이미 만든 WRITE 토큰의 뜻이 몰래 넓어지지 않도록 FULL을 따로 두었다(docs/decisions.md "AI 연결 모든 권한").
 */
export type McpScope = "READ" | "WRITE" | "FULL";

export type McpContext = {
  userId: string;
  nickname: string;
  timezone: string;
  tokenId: string;
  scope: McpScope;
  /** 토큰을 만든 사람이 "친구의 공개 할 일·일정 읽기"를 켰는지. 권한(scope)과 따로다. */
  allowFriends: boolean;
};

export type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

export function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function fail(error: string, extra: Record<string, unknown> = {}): ToolResult {
  return { isError: true, content: [{ type: "text", text: JSON.stringify({ error, ...extra }) }] };
}

/** 바꾸는 도구(만들기·고치기·지우기·되돌리기)는 읽기보다 더 좁게 센다. 10번까지 한꺼번에, 이후 6초에 한 번. */
const WRITE_RULE: RateRule = { capacity: 10, refillPerSecond: 1 / 6 };

/** 남에게 닿는 일(팔로우·반응)은 더 좁게 센다. AI가 잘못 돌아도 남의 폰이 계속 울리지 않게. 5번까지 한꺼번에, 이후 15초에 한 번. */
const SOCIAL_RULE: RateRule = { capacity: 5, refillPerSecond: 1 / 15 };

export function writeLimited(ctx: McpContext): ToolResult | null {
  const result = take(`mcp-write:${ctx.tokenId}`, WRITE_RULE);
  return result.ok ? null : fail(`Too many changes in a short time. Retry in ${result.retryAfter} seconds.`);
}

/** 쓰기 한도에 더해 남에게 닿는 일의 한도도 센다. */
export function socialLimited(ctx: McpContext): ToolResult | null {
  const limited = writeLimited(ctx);
  if (limited) return limited;
  const result = take(`mcp-social:${ctx.tokenId}`, SOCIAL_RULE);
  return result.ok ? null : fail(`Too many social actions (follow, unfollow, reactions) in a short time. Retry in ${result.retryAfter} seconds.`);
}

/** 20개를 한 번에 만드는 트랜잭션은 질의가 스무 번을 넘는다. DB가 멀리 있어도(개발·시험) 기본 5초에 걸리지 않게 늘린다. */
export const BULK_TRANSACTION = { maxWait: 10_000, timeout: 20_000 } as const;

/** 서버 액션(addTodo, moveTodo)과 같은 범위: 오늘에서 이만큼 안의 날만 받는다. */
export const MAX_DAYS_FROM_TODAY = 366;
export const MAX_EVENT_SPAN_DAYS = 366;

/** 묶음 기록은 이 기간만 둔다(되돌릴 수 있는 24시간보다 넉넉히). */
const BATCH_KEEP_DAYS = 7;

export function parseDay(value: string): Date | null {
  try {
    return parseKSTDate(value);
  } catch (error) {
    // 2월 30일처럼 모양은 맞지만 없는 날은 호출한 AI에게 오류로 돌려준다(로그가 필요한 일이 아니다). 그 밖의 오류는 그대로 올린다.
    if (error instanceof RangeError) return null;
    throw error;
  }
}

export const dayText = (date: Date) => formatKST(date);

/** 지난 묶음 기록을 치운다. 되돌리기에만 쓰는 기록이라 오래 둘 이유가 없다. 실패해도 일은 이미 끝났으니 기록만 남긴다. */
export async function pruneBatches(userId: string): Promise<void> {
  try {
    await prisma.mcpBatch.deleteMany({ where: { userId, createdAt: { lt: new Date(Date.now() - BATCH_KEEP_DAYS * 86_400_000) } } });
  } catch (error) {
    console.warn("[mcp] 지난 묶음 기록을 지우지 못했다.", error instanceof Error ? error.name : error);
  }
}

/** 기간을 읽는다. 조회 도구들이 같은 검사를 한다(진짜 날짜, to가 from보다 늦지 않게, 최대 listDays). */
export function readRange(input: { from: string; to?: string }): { from: Date; to: Date } | ToolResult {
  const from = parseDay(input.from);
  const to = input.to === undefined ? from : parseDay(input.to);
  if (!from || !to) return fail("'from' and 'to' must be real dates (YYYY-MM-DD).");
  const span = daysBetween(from, to);
  if (span < 0) return fail("'to' is before 'from'.");
  if (span > MCP_LIMITS.listDays) return fail(`List at most ${MCP_LIMITS.listDays} days at a time.`);
  return { from, to };
}

export function isRange(value: { from: Date; to: Date } | ToolResult): value is { from: Date; to: Date } {
  return "from" in value;
}

/**
 * 일정 모양 검사(서버 액션 createEvent·updateEvent와 같은 규칙): 끝 날짜가 시작보다 이르지 않고 366일 이하, 시각은 HH:MM, 끝 시각은 시작 시각이
 * 있어야 하며 같은 날이면 시작보다 빠를 수 없다. 문제가 있으면 문장을, 없으면 null.
 */
export function eventShapeProblem(shape: { startDate: Date; endDate: Date; startTime: number | null; endTime: number | null }): string | null {
  const span = daysBetween(shape.startDate, shape.endDate);
  if (span < 0) return "endDate is before startDate.";
  if (span > MAX_EVENT_SPAN_DAYS) return `it is longer than ${MAX_EVENT_SPAN_DAYS} days.`;
  if (shape.startTime === null && shape.endTime !== null) return "endTime needs a startTime.";
  if (shape.startTime !== null && shape.endTime !== null && span === 0 && shape.endTime < shape.startTime) return "endTime is before startTime.";
  return null;
}
