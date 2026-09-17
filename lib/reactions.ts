// 종류를 늘리면 반응이 흐려진다. 넷으로 고정한다.
// "use server" 파일은 async 함수만 내보낼 수 있어서 상수는 여기 둔다.
export const REACTION_EMOJIS = ["👍", "🔥", "👏", "🎉"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/**
 * 반응은 이모지 문자로 저장하되, 화면에는 도리의 표정으로 보여준다.
 * 저장값을 바꾸지 않으므로 이미 남긴 반응도 그대로 새 그림으로 보인다.
 */
export const REACTION_LOOKS: Record<
  ReactionEmoji,
  { mood: "like" | "fire" | "clap" | "party"; label: string }
> = {
  "👍": { mood: "like", label: "좋아요" },
  "🔥": { mood: "fire", label: "불타요" },
  "👏": { mood: "clap", label: "대단해" },
  "🎉": { mood: "party", label: "축하해" },
};

/** 예전에 저장된 알 수 없는 값이면 기본 표정으로 보여준다. */
export function lookOfReaction(emoji: string): {
  mood: "like" | "fire" | "clap" | "party" | "happy";
  label: string;
} {
  return REACTION_LOOKS[emoji as ReactionEmoji] ?? { mood: "happy", label: emoji };
}

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
