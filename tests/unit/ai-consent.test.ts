// AI 도우미 동의가 지금 문구에 한 것인지 보는 규칙(lib/ai/consent.ts, 2026-11-19): 받는 곳이 Google에서 Cloudflare로 바뀌기 전의 동의는 다시 받는다.
import { describe, expect, it } from "vitest";

import { AI_CONSENT_VALID_FROM, aiConsentState } from "@/lib/ai/consent";

describe("aiConsentState", () => {
  it("동의한 적이 없으면 처음(none)이다", () => {
    expect(aiConsentState(null)).toBe("none");
    expect(aiConsentState(undefined)).toBe("none");
  });

  it("기준 시각 전의 동의는 다시 필요(stale), 기준 시각부터는 유효(valid)다", () => {
    const edge = AI_CONSENT_VALID_FROM.getTime();
    expect(aiConsentState(new Date(edge - 1))).toBe("stale");
    expect(aiConsentState(new Date(edge))).toBe("valid");
    expect(aiConsentState(new Date(edge + 1))).toBe("valid");
    // Google 문구가 나가던 11-17·18에 한 동의.
    expect(aiConsentState(new Date("2026-11-17T09:00:00+09:00"))).toBe("stale");
    expect(aiConsentState(new Date("2026-11-18T23:59:00+09:00"))).toBe("stale");
  });

  it("기준 시각은 지금보다 늦지 않다(시험 계정은 지금 동의한 것으로 만들어진다)", () => {
    expect(AI_CONSENT_VALID_FROM.getTime()).toBeLessThanOrEqual(Date.now());
    expect(aiConsentState(new Date())).toBe("valid");
  });
});
