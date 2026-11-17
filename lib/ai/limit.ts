import { dateIn, formatKST } from "@/lib/date";
import { AI_LIMITS } from "@/lib/ai/plan";
import { take, type RateRule } from "@/lib/rate-limit";

/**
 * AI 도우미의 사용 한도. 두 겹이다: 짧은 시간에 몰리지 않게(토큰 버킷)와 하루 총량(그 사람 시간대의 하루).
 * 무료 등급은 프로젝트 전체의 분당·일일 한도를 모두가 나눠 쓰므로, 한 사람이 다 쓰지 못하게 막는다.
 * 서버가 한 대·프로세스 하나라 메모리에 센다(lib/rate-limit.ts와 같다). 재시작하면 비워진다.
 */
const BURST_RULE: RateRule = { capacity: 5, refillPerSecond: 1 / 12 };

const perDay = new Map<string, { day: string; count: number }>();

export type AiLimit = { ok: true } | { ok: false; reason: "burst" | "day"; retryAfter?: number };

export function takeAiChat(userId: string, timezone: string, now = new Date()): AiLimit {
  const today = formatKST(dateIn(now, timezone));
  const used = perDay.get(userId);
  const count = used && used.day === today ? used.count : 0;
  if (count >= AI_LIMITS.perDay) return { ok: false, reason: "day" };

  const burst = take(`ai-chat:${userId}`, BURST_RULE, now.getTime());
  if (!burst.ok) return { ok: false, reason: "burst", retryAfter: burst.retryAfter };

  perDay.set(userId, { day: today, count: count + 1 });
  // 어제 것이 쌓이지 않게 가끔 비운다.
  if (perDay.size > 5000) for (const [id, entry] of perDay) if (entry.day !== today) perDay.delete(id);
  return { ok: true };
}

/** 시험용. */
export function resetAiLimits() {
  perDay.clear();
}
