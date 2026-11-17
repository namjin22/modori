import { moodsOf, type CharacterId } from "@/lib/characters";
import { characterMoodOf } from "@/lib/reactions";

/**
 * 일기(2026-11-17 운영자 결정, docs/decisions.md "일기"): 하루 한 편, 글과 기분. 사진은 2단계라 여기에 없다.
 * 날짜는 그 사람의 시간대 달력의 날이다(CLAUDE.md 규칙 2). 서버 액션과 화면이 같은 규칙을 쓰도록 모아 둔다.
 */

/** 일기 한 편의 최대 길이. 이모지는 한 글자로 센다. */
export const MAX_DIARY_LENGTH = 5000;

/** 이 날짜보다 오래된 날의 일기는 쓰지 않는다(입력 실수로 아주 먼 옛날 날짜가 들어오지 않게). */
const EARLIEST_DAY = Date.UTC(2000, 0, 1);

/**
 * "오늘의 기분"은 캐릭터의 표정이다(2026-11-17 요청: 기본 이모지가 별로라 도리·펭이 같은 캐릭터로). 저장하는 값은 반응과 같은 "캐릭터id:표정"
 * (예: "dori:happy", "peng:nap")이라 그림은 ReactionGlyph가 그린다. 고르는 창에는 내가 고른 캐릭터의 표정 열 개를 보이고,
 * 캐릭터를 바꿔도 예전 일기는 그때 고른 캐릭터로 남는다.
 */
export function diaryMoodOptions(character: CharacterId): string[] {
  return moodsOf(character).map((mood) => `${character}:${mood}`);
}

/** 서버가 받아도 되는 기분 값인지. 어느 캐릭터의 표정이든 반응에 있는 것만 받는다. */
export function isDiaryMood(value: unknown): value is string {
  return typeof value === "string" && characterMoodOf(value) !== null;
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
export function readDiaryMood(value: unknown): string | null | undefined {
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
