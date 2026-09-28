import { describe, expect, it } from "vitest";

import { progressMood, statsMood } from "@/lib/dori-mood";

describe("progressMood", () => {
  it("할 일이 없으면 그리지 않는다", () => {
    expect(progressMood(0, 0)).toBeNull();
  });

  it("시작 전 인사, 절반 전 웃음, 절반부터 불꽃, 다 끝내면 박수", () => {
    expect(progressMood(0, 4)).toBe("hello");
    expect(progressMood(1, 4)).toBe("happy");
    expect(progressMood(2, 4)).toBe("fire");
    expect(progressMood(3, 4)).toBe("fire");
    expect(progressMood(4, 4)).toBe("clap");
  });
});

describe("statsMood", () => {
  it("다 해낸 달은 무엇보다 먼저 알아봐 준다", () => {
    expect(statsMood({ rate: 100, streak: 10, isThisMonth: true }).mood).toBe("cool");
  });

  it("이어온 날은 이번 달일 때만 본다", () => {
    expect(statsMood({ rate: 40, streak: 7, isThisMonth: true })).toEqual({
      mood: "fire",
      message: "7일째 이어가고 있어요",
    });
    expect(statsMood({ rate: 40, streak: 7, isThisMonth: false }).mood).toBe("calm");
  });

  it("해낸 비율로 나머지를 고른다", () => {
    expect(statsMood({ rate: 80, streak: 0, isThisMonth: true }).mood).toBe("clap");
    expect(statsMood({ rate: 50, streak: 0, isThisMonth: true }).mood).toBe("happy");
    expect(statsMood({ rate: 49, streak: 0, isThisMonth: true }).mood).toBe("calm");
  });
});
