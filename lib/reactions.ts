import { CHARACTERS, moodsOf, type CharacterId, type CharacterMood } from "@/lib/characters";

/**
 * 친구가 끝낸 일에 보낼 수 있는 반응. 캐릭터 넷(도리·몽이·하루·펭이)의 표정 각 열 개와 이모지 열둘이다.
 * 캐릭터는 누구나 어느 것이든 쓸 수 있다(프로필 사진으로 고른 캐릭터와 상관없다).
 *
 * 한때 반응을 도리 표정 넷으로만 그렸다가, 24px로 줄어든 얼굴은 서로 구별되지 않아 이모지로
 * 바꿨다. 지금은 표정마다 소품(모자·불꽃·선글라스·하트 눈)이 있어 작아도 구별되고, 사용자가
 * 도리 표정을 반응으로 보내고 싶어 해서 이모지 옆에 다시 둔다.
 *
 * 저장하는 값은 이모지 문자이거나 "캐릭터id:표정"(예: "dori:fire", "mong:pant")이다. 이모지의 앞 넷은 예전에 저장된 값이라
 * 순서와 글자를 그대로 둔다. 새로 더한 것은 뒤에 붙인다.
 *
 * "use server" 파일은 async 함수만 내보낼 수 있어서 상수는 여기 둔다.
 */
export const REACTIONS = [
  { emoji: "👍", label: "좋아요" },
  { emoji: "🔥", label: "불타요" },
  { emoji: "👏", label: "대단해" },
  { emoji: "🎉", label: "축하해" },
  { emoji: "💪", label: "힘내요" },
  { emoji: "🫶", label: "응원해" },
  { emoji: "✨", label: "반짝반짝" },
  { emoji: "💯", label: "완벽해" },
  { emoji: "😮", label: "놀라워" },
  { emoji: "🥹", label: "감동이야" },
  { emoji: "🌱", label: "꾸준하다" },
  { emoji: "☕", label: "고생했어" },
] as const;

/**
 * 캐릭터 표정 반응. label은 화면 읽기용 이름이고, 표정마다 이름을 붙이지 않는다("몽이 표정 7" 식으로 번호만 단다).
 * 도리의 "졸려"와 "놀람"은 예전에 보낸 반응이 남아 있어 계속 받고 보여주지만(LEGACY), 고르는 창에는 더 두지 않는다.
 */
export type CharacterReaction = { value: string; character: CharacterId; mood: CharacterMood; label: string };

export const CHARACTER_REACTIONS: CharacterReaction[] = CHARACTERS.flatMap((character) =>
  moodsOf(character.id).map((mood, index) => ({
    value: `${character.id}:${mood}`,
    character: character.id,
    mood,
    label: `${character.name} 표정 ${index + 1}`,
  })),
);

const LEGACY_REACTIONS: CharacterReaction[] = (["calm", "wow"] as const).map((mood) => ({
  value: `dori:${mood}`,
  character: "dori" as const,
  mood,
  label: `도리 표정 ${mood === "calm" ? "졸려" : "놀람"}`,
}));

/** 고르는 창과 반응 줄의 순서. 캐릭터가 먼저, 이모지가 뒤다. */
const ORDER: string[] = [
  ...CHARACTER_REACTIONS.map((reaction) => reaction.value),
  ...LEGACY_REACTIONS.map((reaction) => reaction.value),
  ...REACTIONS.map((reaction) => reaction.emoji),
];

const ALLOWED = new Set(ORDER);

/** 서버가 받아도 되는 반응 값인지. 목록 밖의 글자는 저장하지 않는다. */
export function isReactionValue(value: string): boolean {
  return ALLOWED.has(value);
}

const CHARACTER_MOODS = new Map<string, { character: CharacterId; mood: CharacterMood }>(
  [...CHARACTER_REACTIONS, ...LEGACY_REACTIONS].map((reaction) => [
    reaction.value,
    { character: reaction.character, mood: reaction.mood },
  ]),
);

/** 캐릭터 반응이면 어느 캐릭터의 어떤 표정인지, 이모지면 null을 준다. */
export function characterMoodOf(value: string): { character: CharacterId; mood: CharacterMood } | null {
  return CHARACTER_MOODS.get(value) ?? null;
}

const LABELS = new Map<string, string>([
  ...REACTIONS.map((reaction): [string, string] => [reaction.emoji, reaction.label]),
  ...[...CHARACTER_REACTIONS, ...LEGACY_REACTIONS].map((reaction): [string, string] => [reaction.value, reaction.label]),
]);

/** 목록에 없는 값이 저장되어 있어도 화면은 이모지를 그대로 보여준다. */
export function labelOfReaction(emoji: string): string {
  return LABELS.get(emoji) ?? emoji;
}

export type ReactionSummary = {
  emoji: string;
  count: number;
  mine: boolean;
};

/**
 * 반응 행 목록을 이모지별 개수와 내가 눌렀는지로 접는다.
 *
 * **아무도 누르지 않은 것은 넣지 않는다.** 스물네 개를 늘 늘어놓으면 할 일 한 줄보다
 * 반응 줄이 길어진다. 새로 보낼 때는 고르는 창을 연다.
 *
 * 서버 컴포넌트에서 부르므로 "use client" 파일에 두지 않는다. 거기 두면
 * 서버에서는 함수가 아니라 참조만 받아서 호출하는 순간 터진다.
 */
export function summarizeReactions(
  reactions: { emoji: string; userId: string }[],
  viewerId: string,
): ReactionSummary[] {
  const counts = new Map<string, ReactionSummary>();

  for (const reaction of reactions) {
    let summary = counts.get(reaction.emoji);
    if (!summary) {
      summary = { emoji: reaction.emoji, count: 0, mine: false };
      counts.set(reaction.emoji, summary);
    }
    summary.count += 1;
    if (reaction.userId === viewerId) summary.mine = true;
  }

  // 화면 순서는 고른 순서가 아니라 목록 순서를 따른다. 그래야 같은 자리에 남는다.
  const order = new Map<string, number>(ORDER.map((value, index) => [value, index]));
  return [...counts.values()].sort(
    (a, b) => (order.get(a.emoji) ?? 99) - (order.get(b.emoji) ?? 99),
  );
}

/**
 * 이모지별로 내가 아닌 사람들이 누구인지(먼저 누른 순서). 칩을 누르면 누가 눌렀는지 보여주는 데 쓴다.
 * 내가 누른 것은 화면에서 "나"로 따로 붙인다(방금 누르거나 취소한 것이 바로 반영되게).
 */
export function othersByEmoji(
  reactions: { emoji: string; userId: string; user?: { nickname: string | null } | null }[],
  viewerId: string,
): Record<string, string[]> {
  const names: Record<string, string[]> = {};
  for (const reaction of reactions) {
    const nickname = reaction.user?.nickname;
    if (reaction.userId === viewerId || !nickname) continue;
    (names[reaction.emoji] ??= []).push(nickname);
  }
  return names;
}

export type ReceivedReaction = { emoji: string; count: number; names: string[] };

/**
 * 내 할 일에 친구들이 보낸 반응을 종류별로 묶는다. 홈 화면 할 일 밑에 투두메이트처럼 보여준다.
 * 보낸 사람 이름은 먼저 보낸 순서대로. 종류 순서는 고르는 창 순서를 따른다(summarizeReactions와 같다).
 */
export function groupReceivedReactions(
  reactions: { emoji: string; nickname: string | null }[],
): ReceivedReaction[] {
  const groups = new Map<string, ReceivedReaction>();
  for (const reaction of reactions) {
    const group = groups.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, names: [] };
    group.count += 1;
    if (reaction.nickname) group.names.push(reaction.nickname);
    groups.set(reaction.emoji, group);
  }
  const order = new Map<string, number>(ORDER.map((value, index) => [value, index]));
  return [...groups.values()].sort(
    (a, b) => (order.get(a.emoji) ?? 99) - (order.get(b.emoji) ?? 99),
  );
}
