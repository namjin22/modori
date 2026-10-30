import type { Prisma } from "@prisma/client";

import { notBlockedWith } from "@/lib/blocks";
import { doneNotice } from "@/lib/notices";
import { prisma } from "@/lib/prisma";
import { sendPushToUser, shouldNotify } from "@/lib/push";

/**
 * 친구가 할 일을 끝냈을 때의 알림(2026-10-17 요청). 소셜 탭의 알림 목록·뱃지, 그리고 모바일 앱 푸시.
 * 보이는 범위는 피드와 같다: 내가 팔로우한, 차단 관계가 없는 사람의 공개 카테고리에서 끝낸 일.
 * 새로 저장하는 것은 없다. 할 일의 끝낸 시각(doneAt)과 내가 알림을 본 시각(lastSeenAt)으로 센다.
 */
export function friendDoneWhere(viewerId: string, since?: Date): Prisma.TodoWhereInput {
  return {
    done: true,
    category: { isPublic: true },
    ...(since && { doneAt: { gt: since } }),
    user: { nickname: { not: null }, followers: { some: { followerId: viewerId } }, ...notBlockedWith(viewerId) },
  };
}

/**
 * 뱃지에 더할 수. 끝낸 일의 개수가 아니라 "새로 끝낸 일이 있는 친구"의 수다. 친구 하나가 열 개를 끝내도 1로 센다
 * (개수로 세면 뱃지가 늘 수십이 되어 반응·팔로우 알림이 묻힌다).
 */
export async function countFriendsDoneSince(viewerId: string, since: Date): Promise<number> {
  const groups = await prisma.todo.groupBy({ by: ["userId"], where: friendDoneWhere(viewerId, since) });
  return groups.length;
}

// 같은 친구의 끝냄 알림은 한 사람에게 10분에 한 번(lib/push.ts의 shouldNotify). 연달아 체크해도 폰이 계속 울리지 않는다.

/** 할 일을 끝낸 사람의 팔로워에게 푸시(앱·웹)를 보낸다. 공개 카테고리의 할 일일 때만, 알림을 끈 사람(notifyFriendDone)은 빼고. */
export async function notifyFollowersOfDone(doer: { id: string; nickname: string }, todoId: string): Promise<void> {
  const todo = await prisma.todo.findFirst({
    where: { id: todoId, userId: doer.id, done: true, category: { isPublic: true } },
    select: { content: true },
  });
  if (!todo) return;

  const followers = await prisma.user.findMany({
    where: {
      following: { some: { followingId: doer.id } },
      nickname: { not: null },
      notifyFriendDone: true,
      // 앱 기기나 웹 푸시를 켠 브라우저가 하나라도 있는 사람만.
      OR: [{ pushTokens: { some: {} } }, { webPushSubscriptions: { some: {} } }],
      ...notBlockedWith(doer.id),
    },
    select: { id: true },
  });

  for (const follower of followers) {
    if (!shouldNotify(`done:${doer.id}:${follower.id}`)) continue;
    await sendPushToUser(follower.id, (locale) => ({
      ...doneNotice(locale, doer.nickname, todo.content),
      url: `/feed/u/${doer.id}`,
      tag: `done:${doer.id}`,
    }));
  }
}
