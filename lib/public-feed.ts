import type { Prisma } from "@prisma/client";

import { isAdmin } from "@/lib/admin";
import { notBlockedWith } from "@/lib/blocks";

/**
 * 공개 피드(2026-10-19). 모르는 사람에게도 끝낸 할 일과 짧은 글을 나눈다. 사진·댓글은 없다(운영자 결정: 글과 이모지 반응만).
 *
 * iOS 심사가 끝날 때까지 사용자에게는 숨긴다(운영자 결정). 그동안은 운영자 계정에만 보여 미리 써 본다.
 * 모두에게 열 때는 LAUNCHED를 true로 바꾼다. 시험 서버는 환경 변수 PUBLIC_FEED=on으로 연다(playwright.config.ts).
 */
const LAUNCHED = false;

export async function canSeePublicFeed(userId: string): Promise<boolean> {
  return LAUNCHED || process.env.PUBLIC_FEED === "on" || (await isAdmin(userId));
}

/** 이 사람이 볼 수 있는 글: 운영자가 숨기지 않았고, 서로 차단하지 않은 사람이 쓴 것. */
export function visiblePostsWhere(viewerId: string): Prisma.PostWhereInput {
  return { hiddenAt: null, user: { nickname: { not: null }, ...notBlockedWith(viewerId) } };
}
