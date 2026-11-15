import { isTokenUsable, readBearerToken } from "@/lib/api-token";
import { hashApiToken } from "@/lib/api-token-secret";
import type { McpContext } from "@/lib/mcp/tools";
import { prisma } from "@/lib/prisma";
import { take, type RateRule } from "@/lib/rate-limit";

export type McpScope = "READ" | "WRITE";

export type McpAuth =
  | { ok: true; ctx: McpContext; scope: McpScope }
  | { ok: false; status: 401 | 403 | 429; message: string; retryAfter?: number };

/** 토큰 하나가 보내는 요청의 속도 상한(읽기·쓰기 모두). 바꾸는 도구는 tools.ts에서 더 좁게 센다. */
const REQUEST_RULE: RateRule = { capacity: 60, refillPerSecond: 1 };

/** 마지막 사용 시각은 이 간격보다 오래됐을 때만 다시 적는다. 요청마다 DB에 쓰지 않으려는 것이다. */
const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Authorization: Bearer mdr_… 로 사용자를 찾는다. 쿠키·세션은 보지 않는다(브라우저가 몰래 실어 보내는 값으로는 이 길에 들어올 수 없다).
 * 모양이 틀린 값은 DB를 부르지 않고 돌려보내고, 없는 값·지운 값·만료는 이유를 가리지 않고 모두 같은 401로 답한다.
 */
export async function authenticate(request: Request): Promise<McpAuth> {
  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) return { ok: false, status: 401, message: "Missing or malformed access token." };

  const row = await prisma.apiToken.findUnique({
    where: { tokenHash: hashApiToken(token) },
    select: {
      id: true,
      scope: true,
      expiresAt: true,
      lastUsedAt: true,
      user: { select: { id: true, nickname: true, timezone: true } },
    },
  });
  if (!row || !isTokenUsable(row)) return { ok: false, status: 401, message: "Invalid, expired or deleted access token." };
  // 닉네임이 없으면 가입 절차(온보딩)를 끝내지 않은 계정이다.
  if (!row.user.nickname) return { ok: false, status: 403, message: "Finish setting up your modori account first." };

  const limited = take(`mcp:${row.id}`, REQUEST_RULE);
  if (!limited.ok) {
    return { ok: false, status: 429, message: `Too many requests. Retry in ${limited.retryAfter} seconds.`, retryAfter: limited.retryAfter };
  }

  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    try {
      await prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
    } catch (error) {
      // 사용 시각은 목록에 보여 주는 참고값이라, 못 적어도 요청은 계속 처리한다.
      console.warn("[mcp] 토큰 마지막 사용 시각을 적지 못했다.", error instanceof Error ? error.name : error);
    }
  }

  return {
    ok: true,
    scope: row.scope,
    ctx: { userId: row.user.id, nickname: row.user.nickname, timezone: row.user.timezone, tokenId: row.id },
  };
}
