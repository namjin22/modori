import { describe, expect, it } from "vitest";

import {
  DIARY_EMOJIS,
  DIARY_MOODS,
  MAX_DIARY_LENGTH,
  diaryDateProblem,
  diaryExcerpt,
  diaryLength,
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
  it("목록의 이모지만 받고, 빈 값은 고르지 않음(null)이며, 그 밖의 값은 잘못된 값(undefined)이다", () => {
    for (const mood of DIARY_MOODS) expect(readDiaryMood(mood)).toBe(mood);
    expect(readDiaryMood("")).toBeNull();
    expect(readDiaryMood(null)).toBeNull();
    expect(readDiaryMood(undefined)).toBeNull();
    expect(readDiaryMood("🦄")).toBeUndefined();
    expect(readDiaryMood("행복")).toBeUndefined();
    expect(isDiaryMood("😊")).toBe(true);
    expect(isDiaryMood("😊😊")).toBe(false);
  });

  it("이모지 목록에는 중복이 없고, 기분 이모지가 글에 끼우는 목록에도 있다", () => {
    expect(new Set(DIARY_EMOJIS).size).toBe(DIARY_EMOJIS.length);
    expect(new Set(DIARY_MOODS).size).toBe(DIARY_MOODS.length);
    for (const mood of DIARY_MOODS) expect(DIARY_EMOJIS).toContain(mood);
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
