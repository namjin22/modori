import { describe, expect, it } from "vitest";

import {
  MAX_DIARY_LENGTH,
  diaryDateProblem,
  diaryExcerpt,
  diaryLength,
  diaryMoodOptions,
  isDiaryMood,
  readDiaryContent,
  readDiaryMood,
} from "@/lib/diary";

describe("readDiaryContent", () => {
  it("앞뒤 공백을 자르고 줄바꿈은 LF로 맞춘다. 가운데 줄바꿈과 이모지는 그대로 둔다", () => {
    expect(readDiaryContent("  오늘은 좋았다 😊\r\n둘째 줄\r셋째 줄  ")).toEqual({ ok: true, content: "오늘은 좋았다 😊\n둘째 줄\n셋째 줄" });
  });

  it("비었거나 공백뿐이거나 글이 아니면 empty", () => {
    for (const value of ["", "   ", "\n\n", null, undefined, 3]) expect(readDiaryContent(value)).toEqual({ ok: false, reason: "empty" });
  });

  it("5000자까지 받고 넘으면 자르지 않고 tooLong으로 거절한다", () => {
    expect(readDiaryContent("가".repeat(MAX_DIARY_LENGTH)).ok).toBe(true);
    expect(readDiaryContent("가".repeat(MAX_DIARY_LENGTH + 1))).toEqual({ ok: false, reason: "tooLong" });
  });

  it("이모지는 한 글자로 센다(두 칸을 차지해도)", () => {
    expect(diaryLength("😊")).toBe(1);
    expect(diaryLength("가😊나")).toBe(3);
    expect(readDiaryContent("😊".repeat(MAX_DIARY_LENGTH)).ok).toBe(true);
    expect(readDiaryContent("😊".repeat(MAX_DIARY_LENGTH + 1)).ok).toBe(false);
  });
});

describe("기분", () => {
  it("내 캐릭터의 표정 열 개를 '캐릭터id:표정' 값으로 준다(반응과 같은 값)", () => {
    expect(diaryMoodOptions("dori")).toEqual([
      "dori:happy",
      "dori:like",
      "dori:party",
      "dori:sad",
      "dori:confused",
      "dori:cool",
      "dori:fire",
      "dori:clap",
      "dori:hello",
      "dori:love",
    ]);
    for (const character of ["dori", "mong", "haru", "peng"] as const) {
      const options = diaryMoodOptions(character);
      expect(options).toHaveLength(10);
      expect(new Set(options).size).toBe(10);
      for (const option of options) expect(isDiaryMood(option)).toBe(true);
    }
    expect(diaryMoodOptions("peng")).toContain("peng:nap");
  });

  it("반응에 있는 캐릭터 표정만 받고, 빈 값은 고르지 않음(null)이며, 그 밖의 값은 잘못된 값(undefined)이다", () => {
    expect(readDiaryMood("peng:nap")).toBe("peng:nap");
    // 도리의 졸림·놀람은 예전 반응으로 남아 있는 값이라 그대로 받는다.
    expect(readDiaryMood("dori:calm")).toBe("dori:calm");
    expect(readDiaryMood("")).toBeNull();
    expect(readDiaryMood(null)).toBeNull();
    expect(readDiaryMood(undefined)).toBeNull();
    // 처음에 쓰던 이모지 값과 목록에 없는 값은 받지 않는다(마이그레이션이 저장된 이모지를 캐릭터 값으로 옮겼다).
    for (const value of ["😊", "🦄", "행복", "dori:nope", "cat:happy", "dori:", ":happy", "dori:happy ", 3]) expect(readDiaryMood(value)).toBeUndefined();
    expect(isDiaryMood("dori:happy")).toBe(true);
    expect(isDiaryMood("😊")).toBe(false);
  });
});

describe("diaryDateProblem", () => {
  const today = new Date("2026-11-17T00:00:00Z");

  it("오늘까지는 쓸 수 있고, 내일부터는 future", () => {
    expect(diaryDateProblem(today, today)).toBeNull();
    expect(diaryDateProblem(new Date("2026-11-16T00:00:00Z"), today)).toBeNull();
    expect(diaryDateProblem(new Date("2026-11-18T00:00:00Z"), today)).toBe("future");
  });

  it("2000년 1월 1일부터 쓸 수 있고 그 전은 tooOld", () => {
    expect(diaryDateProblem(new Date("2000-01-01T00:00:00Z"), today)).toBeNull();
    expect(diaryDateProblem(new Date("1999-12-31T00:00:00Z"), today)).toBe("tooOld");
  });
});

describe("diaryExcerpt", () => {
  it("줄바꿈을 공백으로 펴고, 길면 글자 단위로 자른다(이모지가 반쪽이 되지 않는다)", () => {
    expect(diaryExcerpt("첫째 줄\n\n둘째 줄")).toBe("첫째 줄 둘째 줄");
    expect(diaryExcerpt("😊".repeat(10), 5)).toBe("😊😊😊😊😊…");
    expect(diaryExcerpt("짧은 글", 5)).toBe("짧은 글");
  });
});
