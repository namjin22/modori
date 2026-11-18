import { describe, expect, it } from "vitest";

import {
  DIARY_MOODS,
  MAX_DIARY_LENGTH,
  MOOD_LABEL_KEYS,
  diaryDateProblem,
  diaryExcerpt,
  diaryLength,
  isDiaryMood,
  readDiaryContent,
  readDiaryMood,
} from "@/lib/diary";
import { MOOD_COLORS } from "@/components/mood-icon";
import { diary } from "@/lib/i18n/messages/diary";

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
  it("일기 전용 마음 날씨 여섯 가지만 받는다(기분 좋음에서 나쁨 순서, 마지막은 졸림)", () => {
    expect(DIARY_MOODS).toEqual(["sun", "partly", "cloud", "rain", "storm", "moon"]);
    for (const mood of DIARY_MOODS) {
      expect(readDiaryMood(mood)).toBe(mood);
      expect(isDiaryMood(mood)).toBe(true);
    }
  });

  it("빈 값은 고르지 않음(null)이고, 이모지·캐릭터 표정·대소문자가 다른 값 같은 그 밖의 값은 잘못된 값(undefined)이다", () => {
    expect(readDiaryMood("")).toBeNull();
    expect(readDiaryMood(null)).toBeNull();
    expect(readDiaryMood(undefined)).toBeNull();
    // 처음에는 이모지, 그다음에는 캐릭터 표정이었다(마이그레이션이 지금 값으로 옮겼다). 예전 값은 더 받지 않는다.
    for (const value of ["😊", "dori:happy", "peng:nap", "Sun", "sun ", "rainbow", 3, {}]) {
      expect(readDiaryMood(value)).toBeUndefined();
      expect(isDiaryMood(value)).toBe(false);
    }
  });

  it("기분마다 대표색과 세 언어의 이름이 있다", () => {
    expect(Object.keys(MOOD_COLORS).sort()).toEqual([...DIARY_MOODS].sort());
    for (const mood of DIARY_MOODS) {
      const key = MOOD_LABEL_KEYS[mood];
      for (const locale of ["ko", "en", "ja"] as const) expect(diary[locale][key], `${locale}.${key}`).toBeTruthy();
    }
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
