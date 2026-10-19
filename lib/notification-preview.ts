import { friendDoneWhere } from "@/lib/friend-done";
import { prisma } from "@/lib/prisma";

export type NotificationPreview = { key: string; at: number; title: string; body: string; url: string };

/**
 * 안 읽은 알림의 종류(반응·팔로우·친구가 끝낸 일)마다 가장 최근 것 하나씩, 최근 순. 웹·데스크톱 창을 열어 둔 사람에게
 * 컴퓨터 알림으로 띄울 글이다(2026-10-19 요청). 문구와 key는 앱 푸시의 문구·tag와 같다(app/(tabs)/feed/actions.ts, lib/friend-done.ts).
 * 창은 at(그 일이 일어난 시각)이 지난번에 물은 뒤인 것만 띄우고, 같은 key는 10분에 한 번만 띄운다(components/bottom-nav.tsx).
 */
export async function latestUnreadNotifications(
  userId: string,
  since: Date,
  friendDone: boolean,
): Promise<NotificationPreview[]> {
  const [reaction, follow, done] = await Promise.all([
    prisma.reaction.findFirst({
      where: { todoUserId: userId, userId: { not: userId }, createdAt: { gt: since } },
      orderBy: { createdAt: "desc" },
      select: { userId: true, todoId: true, createdAt: true, user: { select: { nickname: true } } },
    }),
    prisma.follow.findFirst({
      where: { followingId: userId, createdAt: { gt: since } },
      orderBy: { createdAt: "desc" },
      select: { followerId: true, createdAt: true, follower: { select: { nickname: true } } },
    }),
    friendDone
      ? prisma.todo.findFirst({
          where: friendDoneWhere(userId, since),
          orderBy: { doneAt: "desc" },
          select: { id: true, content: true, doneAt: true, user: { select: { id: true, nickname: true } } },
        })
      : null,
  ]);

  const previews: NotificationPreview[] = [];
  if (reaction) {
    previews.push({
      // 같은 사람이 같은 할 일에 이모지를 더 누르거나 껐다 켜도 한 번만 울리도록 사람·할 일로 묶는다.
      key: `reaction:${reaction.userId}:${reaction.todoId}`,
      at: reaction.createdAt.getTime(),
      title: "반응이 왔어요",
      body: `${reaction.user.nickname ?? "친구"}님이 내 할 일에 반응을 보냈어요`,
      url: "/feed/reactions",
    });
  }
  if (follow) {
    previews.push({
      key: `follow:${follow.followerId}`,
      at: follow.createdAt.getTime(),
      title: "새 팔로워",
      body: `${follow.follower.nickname ?? "누군가"}님이 나를 팔로우했어요`,
      url: "/feed/followers",
    });
  }
  if (done?.doneAt) {
    previews.push({
      key: `done:${done.user.id}`,
      at: done.doneAt.getTime(),
      title: `${done.user.nickname ?? "친구"}님이 할 일을 끝냈어요`,
      body: done.content,
      url: `/feed/u/${done.user.id}`,
    });
  }
  return previews.sort((a, b) => b.at - a.at);
}
