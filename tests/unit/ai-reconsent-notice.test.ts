// 다시 동의 안내(바뀐 점)는 기준 시각부터 7일만 보인다(lib/ai/consent.ts, 2026-11-20). 동의 자체는 그 뒤에도 필요하다.
import { describe, expect, it } from "vitest";

import { AI_CONSENT_VALID_FROM, AI_RECONSENT_NOTICE_UNTIL, aiConsentState, showReconsentNotice } from "@/lib/ai/consent";

const DAY = 24 * 60 * 60 * 1000;

describe("showReconsentNotice", () => {
  it("보이는 기간은 기준 시각부터 정확히 7일이다", () => {
    expect(AI_RECONSENT_NOTICE_UNTIL.getTime() - AI_CONSENT_VALID_FROM.getTime()).toBe(7 * DAY);
    expect(AI_RECONSENT_NOTICE_UNTIL.toISOString()).toBe("2026-11-26T01:20:00.000Z");
  });

  it("옛 동의자에게는 기간 안에서만 보이고, 끝나는 순간부터 안 보인다", () => {
    const end = AI_RECONSENT_NOTICE_UNTIL.getTime();
    expect(showReconsentNotice("stale", AI_CONSENT_VALID_FROM)).toBe(true);
    expect(showReconsentNotice("stale", new Date(end - 1))).toBe(true);
    expect(showReconsentNotice("stale", new Date(end))).toBe(false);
    expect(showReconsentNotice("stale", new Date(end + 30 * DAY))).toBe(false);
  });

  it("처음인 사람과 이미 동의한 사람에게는 기간 안에서도 보이지 않는다", () => {
    const within = new Date(AI_CONSENT_VALID_FROM.getTime() + DAY);
    expect(showReconsentNotice("none", within)).toBe(false);
    expect(showReconsentNotice("valid", within)).toBe(false);
  });

  it("안내가 사라져도 옛 동의는 여전히 다시 필요하다(동의 상태는 날짜와 상관없다)", () => {
    const old = new Date(AI_CONSENT_VALID_FROM.getTime() - DAY);
    expect(aiConsentState(old)).toBe("stale");
    expect(showReconsentNotice(aiConsentState(old), new Date(AI_RECONSENT_NOTICE_UNTIL.getTime() + DAY))).toBe(false);
  });
});
