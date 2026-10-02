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
