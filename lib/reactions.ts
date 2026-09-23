/**
 * 친구가 끝낸 일에 보낼 수 있는 반응.
 *
 * 예전에는 도리의 표정으로 그렸는데, 24px로 줄어든 얼굴 넷은 서로 구별되지 않았다.
 * 종류를 열둘로 늘리면서 이모지 그대로 보여준다. 이모지는 설명 없이도 뜻이 통한다.
 * 도리는 크게 나오는 자리(빈 화면, 축하, 오류)에서만 쓴다.
 *
 * 저장하는 값은 이모지 문자다. 앞의 넷은 예전에 저장된 값이라 순서와 글자를
 * 그대로 둔다. 새로 더한 것은 뒤에 붙인다.
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

export const REACTION_EMOJIS = REACTIONS.map(
  (reaction) => reaction.emoji,
) as readonly ReactionEmoji[];

export type ReactionEmoji = (typeof REACTIONS)[number]["emoji"];

const LABELS = new Map<string, string>(
  REACTIONS.map((reaction) => [reaction.emoji, reaction.label]),
);

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
 * **아무도 누르지 않은 것은 넣지 않는다.** 열두 개를 늘 늘어놓으면 할 일 한 줄보다
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
  const order = new Map<string, number>(
    REACTIONS.map((reaction, index) => [reaction.emoji, index]),
  );
  return [...counts.values()].sort(
    (a, b) => (order.get(a.emoji) ?? 99) - (order.get(b.emoji) ?? 99),
  );
}
