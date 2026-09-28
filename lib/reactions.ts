import type { DoriMood } from "@/components/dori";

/**
 * 친구가 끝낸 일에 보낼 수 있는 반응. 도리 표정 열둘과 이모지 열둘이다.
 *
 * 한때 반응을 도리 표정 넷으로만 그렸다가, 24px로 줄어든 얼굴은 서로 구별되지 않아 이모지로
 * 바꿨다. 지금은 표정마다 소품(모자·불꽃·선글라스·하트 눈)이 있어 작아도 구별되고, 사용자가
 * 도리 표정을 반응으로 보내고 싶어 해서 이모지 옆에 다시 둔다.
 *
 * 저장하는 값은 이모지 문자이거나 "dori:표정"이다. 이모지의 앞 넷은 예전에 저장된 값이라
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

const DORI_PREFIX = "dori:";

/**
 * 도리 표정 반응. name은 고르는 창에서 얼굴 아래 적는 말이고, label은 화면 읽기용 이름이다.
 * 이모지와 이름이 겹치는 것(불타요·대단해·축하해·놀라워)이 있어 label 앞에 "도리"를 붙인다.
 */
export const DORI_REACTIONS: { value: string; mood: DoriMood; name: string; label: string }[] = (
  [
    ["happy", "방긋"],
    ["love", "반했어"],
    ["like", "좋아해"],
    ["clap", "대단해"],
    ["fire", "불타요"],
    ["party", "축하해"],
    ["cool", "멋져"],
    ["wow", "놀라워"],
    ["hello", "안녕"],
    ["calm", "느긋해"],
    ["confused", "갸웃"],
    ["sad", "아쉬워"],
  ] as const
).map(([mood, name]) => ({
  value: `${DORI_PREFIX}${mood}`,
  mood,
  name,
  label: `도리 ${name}`,
}));

/** 고르는 창과 반응 줄의 순서. 도리가 먼저다. */
const ORDER: string[] = [
  ...DORI_REACTIONS.map((reaction) => reaction.value),
  ...REACTIONS.map((reaction) => reaction.emoji),
];

const ALLOWED = new Set(ORDER);

/** 서버가 받아도 되는 반응 값인지. 목록 밖의 글자는 저장하지 않는다. */
export function isReactionValue(value: string): boolean {
  return ALLOWED.has(value);
}

const DORI_MOODS = new Map<string, DoriMood>(
  DORI_REACTIONS.map((reaction) => [reaction.value, reaction.mood]),
);

/** 도리 반응이면 표정을, 이모지면 null을 준다. */
export function doriMoodOf(value: string): DoriMood | null {
  return DORI_MOODS.get(value) ?? null;
}

const LABELS = new Map<string, string>([
  ...REACTIONS.map((reaction): [string, string] => [reaction.emoji, reaction.label]),
  ...DORI_REACTIONS.map((reaction): [string, string] => [reaction.value, reaction.label]),
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
