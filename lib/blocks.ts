import type { Prisma } from "@prisma/client";

/**
 * 나와 차단 관계가 없는 사람만 고르는 조건(내가 차단했거나 나를 차단한 사람은 빠진다). 찾기·추천·친구의 팔로우 목록처럼
 * 사람을 늘어놓는 곳에서 User 조건에 합쳐 쓴다.
 */
export function notBlockedWith(viewerId: string): Prisma.UserWhereInput {
  return {
    blocking: { none: { blockedId: viewerId } },
    blockedBy: { none: { blockerId: viewerId } },
  };
}
