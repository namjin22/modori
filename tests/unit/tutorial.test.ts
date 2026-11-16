import { describe, expect, it } from "vitest";

import { LOCALES, translator } from "@/lib/i18n";
import { tutorial } from "@/lib/i18n/messages/tutorial";
import { TIP, TOUR_STEPS, placeTip, shouldAutoShowTutorial, tourMode, type Spot } from "@/lib/tutorial";

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

describe("tourMode", () => {
  it("?tour=1은 이미 본 사람에게도 다시 보기로 연다", () => {
    expect(tourMode({ auto: false, param: "1" })).toBe("replay");
    expect(tourMode({ auto: true, param: "1" })).toBe("replay");
  });

  it("처음이면 first, 아니면 띄우지 않는다. 다른 값은 무시한다", () => {
    expect(tourMode({ auto: true, param: undefined })).toBe("first");
    expect(tourMode({ auto: false, param: undefined })).toBeNull();
    expect(tourMode({ auto: false, param: "0" })).toBeNull();
    expect(tourMode({ auto: false, param: "true" })).toBeNull();
  });
});

describe("둘러보기 단계와 글", () => {
  it("모든 단계에 제목·설명이 세 언어로 비어 있지 않게 있다", () => {
    for (const locale of LOCALES) {
      const t = translator(tutorial, locale);
      for (const step of TOUR_STEPS) {
        for (const key of [`${step.id}Title`, `${step.id}Body`] as const) {
          expect(t(key).trim().length, `${locale} ${key}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("첫 단계만 짚을 곳이 없고, 단계 id와 짚을 곳이 겹치지 않는다", () => {
    expect(TOUR_STEPS[0].target).toBeNull();
    const targets = TOUR_STEPS.slice(1).map((step) => step.target);
    expect(targets.every((target) => typeof target === "string")).toBe(true);
    expect(new Set(TOUR_STEPS.map((step) => step.id)).size).toBe(TOUR_STEPS.length);
    expect(new Set(targets).size).toBe(targets.length);
  });
});

describe("placeTip(말풍선 자리)", () => {
  const phone = { width: 390, height: 844 };
  const spotAt = (top: number, height: number, left = 20, width = 100): Spot => ({ top, left, width, height, radius: 12 });

  it("짚을 곳이 없으면 화면 가운데다", () => {
    const place = placeTip(null, phone);
    expect(place.side).toBe("middle");
    expect(place.arrow).toBeNull();
    expect(place.left + place.width / 2).toBeCloseTo(phone.width / 2);
  });

  it("크기가 0인 짚는 곳도 가운데로 본다", () => {
    expect(placeTip({ top: 422, left: 195, width: 0, height: 0, radius: 0 }, phone).side).toBe("middle");
  });

  it("아래에 자리가 있으면 짚은 곳 바로 아래에 둔다", () => {
    const place = placeTip(spotAt(100, 40), phone);
    expect(place.side).toBe("below");
    expect(place.offset).toBe(100 + 40 + TIP.gap);
  });

  it("말풍선이 높아 통째로 들어가지 않으면 같은 자리라도 다른 곳으로 간다", () => {
    expect(placeTip(spotAt(100, 40), phone, 240).side).toBe("below");
    expect(placeTip(spotAt(100, 40), phone, 700).side).toBe("edge-bottom");
  });

  it("아래에 자리가 없으면 위에 붙이고, 화면 아래에서부터 잰다", () => {
    const place = placeTip(spotAt(760, 40), phone);
    expect(place.side).toBe("above");
    expect(place.offset).toBe(phone.height - 760 + TIP.gap);
  });

  it("넓은 화면에서 위아래가 모자라면 짚은 곳의 옆에 붙이고, 세로는 짚은 곳 가운데에 맞춘다", () => {
    const desktop = { width: 1280, height: 720 };
    // 왼쪽의 큰 달력: 아래(149)·위(97)에는 못 들어가지만 오른쪽에는 넉넉하다.
    const right = placeTip({ top: 97, left: 143, width: 468, height: 474, radius: 12 }, desktop);
    expect(right.side).toBe("right");
    expect(right.left).toBe(143 + 468 + TIP.gap);
    expect(right.arrow).not.toBeNull();
    // 오른쪽 끝의 큰 칸이면 왼쪽에 붙인다.
    const left = placeTip({ top: 97, left: 900, width: 300, height: 474, radius: 12 }, desktop);
    expect(left.side).toBe("left");
    expect(left.left + left.width + TIP.gap).toBe(900);
  });

  it("옆에 붙인 말풍선의 세로 자리는 화면 안에 갇힌다", () => {
    const desktop = { width: 1280, height: 720 };
    const nearTop = placeTip({ top: 0, left: 100, width: 400, height: 700, radius: 12 }, desktop, 300);
    expect(nearTop.side).toBe("right");
    expect(nearTop.offset).toBeGreaterThanOrEqual(TIP.margin);
    expect(nearTop.offset + 300).toBeLessThanOrEqual(desktop.height - TIP.margin);
  });

  it("폰처럼 옆 자리도 없으면 화면 끝에 두고 화살표는 없다", () => {
    const tall = { width: 390, height: 400 };
    const upper = placeTip(spotAt(60, 200), tall);
    expect(upper.side).toBe("edge-bottom");
    expect(upper.arrow).toBeNull();
    const lower = placeTip(spotAt(150, 200), tall);
    expect(lower.side).toBe("edge-top");
  });

  it("말풍선은 화면 가장자리에서 여백만큼 안쪽에 머문다(좁은 폰·가장자리 버튼)", () => {
    const narrow = { width: 320, height: 640 };
    for (const spot of [spotAt(100, 40, 0, 60), spotAt(100, 40, 300, 60)]) {
      const place = placeTip(spot, narrow);
      expect(place.width).toBeLessThanOrEqual(narrow.width - TIP.margin * 2);
      expect(place.left).toBeGreaterThanOrEqual(TIP.margin);
      expect(place.left + place.width).toBeLessThanOrEqual(narrow.width - TIP.margin);
    }
  });

  it("화살표는 말풍선 안쪽에 있고 짚은 곳의 가운데를 가리킨다", () => {
    const place = placeTip(spotAt(100, 40, 150, 100), phone);
    expect(place.arrow).not.toBeNull();
    expect(place.left + (place.arrow ?? 0)).toBeCloseTo(200);
    const edge = placeTip(spotAt(100, 40, 0, 40), phone);
    expect(edge.arrow).toBeGreaterThanOrEqual(TIP.arrowInset);
  });
});
