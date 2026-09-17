// 종류를 늘리면 반응이 흐려진다. 넷으로 고정한다.
// "use server" 파일은 async 함수만 내보낼 수 있어서 상수는 여기 둔다.
export const REACTION_EMOJIS = ["👍", "🔥", "👏", "🎉"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export type ReactionSummary = {
  emoji: ReactionEmoji;
  count: number;
  mine: boolean;
};

/**
 * 반응 행 목록을 이모지별 개수와 내가 눌렀는지로 접는다.
 * 서버 컴포넌트에서 부르므로 "use client" 파일에 두지 않는다.
 * 거기 두면 서버에서는 함수가 아니라 참조만 받아서 호출하는 순간 터진다.
 */
export function summarizeReactions(
  reactions: { emoji: string; userId: string }[],
  viewerId: string,
): ReactionSummary[] {
  return REACTION_EMOJIS.map((emoji) => ({
    emoji,
    count: reactions.filter((reaction) => reaction.emoji === emoji).length,
    mine: reactions.some(
      (reaction) => reaction.emoji === emoji && reaction.userId === viewerId,
    ),
  }));
}
