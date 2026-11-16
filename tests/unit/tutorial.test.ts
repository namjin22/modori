import { describe, expect, it } from "vitest";

import { LOCALES, translator } from "@/lib/i18n";
import { tutorial } from "@/lib/i18n/messages/tutorial";
import { TUTORIAL_STEPS, shouldAutoShowTutorial } from "@/lib/tutorial";

const SEEN = new Date("2026-11-16T00:00:00Z");

describe("shouldAutoShowTutorial", () => {
  it("아직 안 본 사람에게는 보여 준다(운영)", () => {
    expect(shouldAutoShowTutorial({ tutorialSeenAt: null, mockAuth: false, testHeader: null })).toBe(true);
  });

  it("끝내거나 건너뛴 사람, 이 기능이 생길 때 있던 사람(시각이 채워져 있다)에게는 보이지 않는다", () => {
    expect(shouldAutoShowTutorial({ tutorialSeenAt: SEEN, mockAuth: false, testHeader: null })).toBe(false);
    expect(shouldAutoShowTutorial({ tutorialSeenAt: SEEN, mockAuth: false, testHeader: "on" })).toBe(false);
  });

  it("운영에서는 시험용 머리글을 보지 않는다", () => {
    expect(shouldAutoShowTutorial({ tutorialSeenAt: null, mockAuth: false, testHeader: "off" })).toBe(true);
  });

  it("시험 서버(mock)에서는 머리글이 on일 때만 보여 준다", () => {
    expect(shouldAutoShowTutorial({ tutorialSeenAt: null, mockAuth: true, testHeader: null })).toBe(false);
    expect(shouldAutoShowTutorial({ tutorialSeenAt: null, mockAuth: true, testHeader: "yes" })).toBe(false);
    expect(shouldAutoShowTutorial({ tutorialSeenAt: null, mockAuth: true, testHeader: "on" })).toBe(true);
    expect(shouldAutoShowTutorial({ tutorialSeenAt: SEEN, mockAuth: true, testHeader: "on" })).toBe(false);
  });
});

describe("사용법 카드의 글", () => {
  it("모든 카드에 제목·설명·세 줄이 세 언어로 비어 있지 않게 있다", () => {
    for (const locale of LOCALES) {
      const t = translator(tutorial, locale);
      for (const step of TUTORIAL_STEPS) {
        for (const key of [`${step.id}Title`, `${step.id}Body`, `${step.id}1`, `${step.id}2`, `${step.id}3`] as const) {
          expect(t(key).trim().length, `${locale} ${key}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("카드는 다섯 장이고 id가 겹치지 않는다", () => {
    expect(TUTORIAL_STEPS).toHaveLength(5);
    expect(new Set(TUTORIAL_STEPS.map((step) => step.id)).size).toBe(5);
  });
});
