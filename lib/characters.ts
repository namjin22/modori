import type { DoriMood } from "@/components/dori";

/**
 * 모도리의 캐릭터 목록. 마이페이지에서 고른 캐릭터가 웹 곳곳(빈 화면, 반응, 축하 배너, 프로필 사진 대체)에 도리 대신 나온다.
 * 그림은 components/dori.tsx가 이 id로 그린다. 새 캐릭터를 더할 때는 여기와 그림, 색(PALETTES)을 같이 더한다.
 */
export const CHARACTERS = [
  { id: "dori", name: "도리", animal: "고양이" },
  { id: "mong", name: "몽이", animal: "강아지" },
  { id: "haru", name: "하루", animal: "여우" },
  { id: "peng", name: "펭이", animal: "펭귄" },
] as const;

export type CharacterId = (typeof CHARACTERS)[number]["id"];

export const DEFAULT_CHARACTER: CharacterId = "dori";

export function isCharacterId(value: unknown): value is CharacterId {
  return CHARACTERS.some((character) => character.id === value);
}

/** 캐릭터마다 하나뿐인 표정(개성 표정). 공통 표정은 DoriMood(도리 표정 이름)를 그대로 쓴다. */
export type SpecialMood =
  | "pant" // 몽이: 헥헥(신남)
  | "bone" // 몽이: 뼈다귀 물기
  | "beg" // 몽이: 부탁해(반짝 눈)
  | "ball" // 몽이: 공놀이
  | "wink" // 하루: 찡긋
  | "shy" // 하루: 수줍
  | "foxfire" // 하루: 여우불(파이팅)
  | "smug" // 하루: 흐뭇
  | "fish" // 펭이: 물고기 냠
  | "snowman" // 펭이: 눈사람 친구
  | "nap" // 펭이: 낮잠
  | "goggles"; // 펭이: 물안경

export type CharacterMood = DoriMood | SpecialMood;

/** 모든 캐릭터가 가진 기본 표정. "happy"는 프로필 사진에 쓴다. */
export const COMMON_MOODS: CharacterMood[] = ["happy", "like", "party", "sad", "confused", "cool"];

/** 캐릭터마다 다른 개성 표정 네 개. */
export const UNIQUE_MOODS: Record<CharacterId, CharacterMood[]> = {
  dori: ["fire", "clap", "hello", "love"],
  mong: ["pant", "bone", "beg", "ball"],
  haru: ["wink", "shy", "foxfire", "smug"],
  peng: ["fish", "snowman", "nap", "goggles"],
};

/** 캐릭터가 쓰는 표정 열 개(공통 여섯 + 개성 넷). */
export function moodsOf(character: CharacterId): CharacterMood[] {
  return [...COMMON_MOODS, ...UNIQUE_MOODS[character]];
}
