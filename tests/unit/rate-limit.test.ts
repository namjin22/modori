import { beforeEach, describe, expect, it } from "vitest";

import { resetRateLimits, take } from "@/lib/rate-limit";

const RULE = { capacity: 3, refillPerSecond: 1 };

describe("take", () => {
  beforeEach(resetRateLimits);

  it("한 번에 capacity만큼 쓰고 그다음은 막는다", () => {
    const now = 1_000_000;
    expect(take("a", RULE, now).ok).toBe(true);
    expect(take("a", RULE, now).ok).toBe(true);
    expect(take("a", RULE, now).ok).toBe(true);
    const blocked = take("a", RULE, now);
    expect(blocked).toEqual({ ok: false, retryAfter: 1 });
  });

  it("시간이 지나면 다시 찬다", () => {
    const now = 2_000_000;
    for (let i = 0; i < 3; i += 1) take("b", RULE, now);
    expect(take("b", RULE, now).ok).toBe(false);
    expect(take("b", RULE, now + 1000).ok).toBe(true);
  });

  it("사람마다 따로 센다", () => {
    const now = 3_000_000;
    for (let i = 0; i < 3; i += 1) take("c", RULE, now);
    expect(take("c", RULE, now).ok).toBe(false);
    expect(take("d", RULE, now).ok).toBe(true);
  });
});
