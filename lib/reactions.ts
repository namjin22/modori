// 종류를 늘리면 반응이 흐려진다. 넷으로 고정한다.
// "use server" 파일은 async 함수만 내보낼 수 있어서 상수는 여기 둔다.
export const REACTION_EMOJIS = ["👍", "🔥", "👏", "🎉"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
