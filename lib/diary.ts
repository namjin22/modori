/**
 * 일기(2026-11-17 운영자 결정, docs/decisions.md "일기"): 하루 한 편, 글과 기분. 사진은 2단계라 여기에 없다.
 * 날짜는 그 사람의 시간대 달력의 날이다(CLAUDE.md 규칙 2). 서버 액션과 화면이 같은 규칙을 쓰도록 모아 둔다.
 */

/** 일기 한 편의 최대 길이. 이모지는 한 글자로 센다. */
export const MAX_DIARY_LENGTH = 5000;

/** 이 날짜보다 오래된 날의 일기는 쓰지 않는다(입력 실수로 아주 먼 옛날 날짜가 들어오지 않게). */
const EARLIEST_DAY = Date.UTC(2000, 0, 1);

/**
 * "오늘의 기분"은 일기 전용으로 그린 "마음 날씨" 그림 여섯 가지 중 하나다(components/mood-icon.tsx, 2026-11-18 요청: 반응에서 쓰는 캐릭터
 * 표정은 어색하다). 저장하는 값은 아래 이름이고, 처음에는 이모지였다가 캐릭터 표정("dori:happy")이었다(마이그레이션이 옮겼다).
 * 기분 좋음에서 나쁨 순서이고 마지막은 졸림이다.
 */
export const DIARY_MOODS = ["sun", "partly", "cloud", "rain", "storm", "moon"] as const;
export type DiaryMoodKey = (typeof DIARY_MOODS)[number];

/** 기분마다 화면에 보이는 이름의 번역 열쇠(lib/i18n/messages/diary.ts). */
export const MOOD_LABEL_KEYS = {
  sun: "moodSun",
  partly: "moodPartly",
  cloud: "moodCloud",
  rain: "moodRain",
  storm: "moodStorm",
  moon: "moodMoon",
} as const satisfies Record<DiaryMoodKey, string>;

/** 서버가 받아도 되는 기분 값인지. 위 여섯 가지만 받는다. */
export function isDiaryMood(value: unknown): value is DiaryMoodKey {
  return typeof value === "string" && (DIARY_MOODS as readonly string[]).includes(value);
}

/** 글자 수. 이모지처럼 두 칸을 차지하는 글자도 하나로 센다. */
export function diaryLength(text: string): number {
  return Array.from(text).length;
}

export type DiaryContent = { ok: true; content: string } | { ok: false; reason: "empty" | "tooLong" };

/** 폼의 글. 줄바꿈은 LF로 맞추고 앞뒤 공백을 자른다. 비었거나 너무 길면 이유를 돌려준다(자르지 않는다: 쓴 글이 말없이 잘리면 안 된다). */
export function readDiaryContent(value: unknown): DiaryContent {
  const content = typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
  if (content === "") return { ok: false, reason: "empty" };
  if (diaryLength(content) > MAX_DIARY_LENGTH) return { ok: false, reason: "tooLong" };
  return { ok: true, content };
}

/** 폼의 기분. 빈 값은 "고르지 않음"(null), 목록에 없는 값은 잘못된 값(undefined). */
export function readDiaryMood(value: unknown): DiaryMoodKey | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return isDiaryMood(value) ? value : undefined;
}

/** 그 날의 일기를 쓸 수 있는지. 오늘(그 사람의 시간대)까지만, 2000년 1월 1일부터. 문제가 없으면 null. */
export function diaryDateProblem(date: Date, today: Date): "future" | "tooOld" | null {
  if (date.getTime() > today.getTime()) return "future";
  if (date.getTime() < EARLIEST_DAY) return "tooOld";
  return null;
}

/** 목록에 보이는 맛보기: 줄바꿈을 공백으로 펴고 글자 수에서 자른다(글자 단위라 이모지가 반쪽이 되지 않는다). */
export function diaryExcerpt(content: string, max = 140): string {
  const flat = content.replace(/\s*\n\s*/g, " ").trim();
  const letters = Array.from(flat);
  return letters.length <= max ? flat : `${letters.slice(0, max).join("")}…`;
}
