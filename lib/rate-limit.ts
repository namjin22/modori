/**
 * 요청 속도 제한(토큰 버킷). proxy.ts가 요청마다 부른다.
 *
 * 서버가 VM 한 대, 프로세스 하나라 메모리에 세면 된다. 재시작하면 비워지지만 그걸로 충분하다.
 * 버킷마다 capacity만큼 한 번에 쓸 수 있고, 초당 refillPerSecond만큼 다시 찬다.
 */
type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();
let calls = 0;

// 오래 안 쓴 버킷은 가득 찬 것과 같으니 지워서 메모리가 늘지 않게 한다.
const IDLE_MS = 10 * 60 * 1000;

export type RateRule = { capacity: number; refillPerSecond: number };

/** 한 번 쓸 수 있으면 true. 모자라면 false와 다시 시도할 때까지의 초. */
export function take(
  key: string,
  rule: RateRule,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfter: number } {
  calls += 1;
  if (calls % 1000 === 0) prune(now);

  const bucket = buckets.get(key) ?? { tokens: rule.capacity, updatedAt: now };
  const refilled = Math.min(
    rule.capacity,
    bucket.tokens + ((now - bucket.updatedAt) / 1000) * rule.refillPerSecond,
  );

  if (refilled < 1) {
    buckets.set(key, { tokens: refilled, updatedAt: now });
    return { ok: false, retryAfter: Math.ceil((1 - refilled) / rule.refillPerSecond) };
  }
  buckets.set(key, { tokens: refilled - 1, updatedAt: now });
  return { ok: true };
}

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > IDLE_MS) buckets.delete(key);
  }
}

/** 시험용. 버킷을 비운다. */
export function resetRateLimits() {
  buckets.clear();
}
