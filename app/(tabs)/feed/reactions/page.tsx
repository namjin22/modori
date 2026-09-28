import type { Metadata } from "next";

import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { DoriMessage } from "@/components/dori-message";
import { ReactionGlyph } from "@/components/reaction-glyph";
import { SubmitButton } from "@/components/submit-button";
import { avatarUrl } from "@/lib/avatar";
import { formatMonthDayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { labelOfReaction } from "@/lib/reactions";
import { requireUser } from "@/lib/session";

import { followUser } from "../actions";

export const metadata: Metadata = { title: "알림 · 모도리" };

const MAX_ITEMS = 50;

/**
 * 알림: 친구가 내 할 일에 보낸 반응과 나를 새로 팔로우한 사람을 시간순으로 모은다.
 * 주소는 예전 이름(받은 반응) 그대로 둔다. 하단 탭 뱃지가 여기로 온다.
 */
export default async function NotificationsPage() {
  const user = await requireUser();

  // 이 화면을 여는 시점이 "읽음" 기준이다. 목록을 먼저 읽고 갱신한다.
  const lastSeenAt = user.lastSeenAt;

  const [reactions, follows, myFollowing] = await Promise.all([
    prisma.reaction.findMany({
      where: { todoUserId: user.id, userId: { not: user.id } },
      orderBy: { createdAt: "desc" },
      take: MAX_ITEMS,
      include: {
        user: { select: { nickname: true } },
        todo: { select: { content: true, date: true } },
      },
    }),
    prisma.follow.findMany({
      where: { followingId: user.id },
      orderBy: { createdAt: "desc" },
      take: MAX_ITEMS,
      select: {
        createdAt: true,
        follower: { select: { id: true, nickname: true, profileImage: true } },
      },
    }),
    prisma.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } }),
  ]);
  const following = new Set(myFollowing.map((follow) => follow.followingId));

  // 두 종류를 한 줄로 세운다. 가장 최근 것이 위.
  const items = [
    ...reactions.map((reaction) => ({ kind: "reaction" as const, at: reaction.createdAt, reaction })),
    ...follows.map((follow) => ({ kind: "follow" as const, at: follow.createdAt, follow })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, MAX_ITEMS);

  // 응답을 보내기 전에 끝내야 한다. after()로 미루면 바로 피드로 돌아갔을 때
  // 아직 안 읽은 것으로 나온다. updateMany를 쓰는 이유는 그 사이 계정이 사라져도
  // 화면 전체가 죽지 않게 하려는 것이다(update는 대상이 없으면 던진다).
  await prisma.user.updateMany({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/feed" label="소셜로" />
        <h1 className="text-2xl font-bold">알림</h1>
      </header>

      {items.length === 0 ? (
        <DoriMessage mood="calm">
          <p>아직 받은 알림이 없어요</p>
          <p className="text-xs">친구가 반응을 보내거나 나를 팔로우하면 여기 모여요</p>
        </DoriMessage>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const isNew = item.at > lastSeenAt;
            const row = `flex items-center gap-3 rounded-2xl p-4 ${isNew ? "bg-brand-subtle" : "bg-surface"}`;
            const newMark = isNew && <span className="shrink-0 text-xs text-brand">NEW</span>;

            if (item.kind === "follow") {
              const person = item.follow.follower;
              return (
                <li key={`follow-${person.id}`} className={row}>
                  <Avatar src={avatarUrl(person)} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-semibold">{person.nickname}</span>
                      <span className="text-muted">님이 나를 팔로우했어요</span>
                    </p>
                    <p className="text-xs text-muted">{formatMonthDayKST(item.at)}</p>
                  </div>
                  {newMark}
                  {/* 아직 팔로우하지 않은 사람이면 그 자리에서 맞팔로우한다. */}
                  {!following.has(person.id) && (
                    <form action={followUser} className="shrink-0">
                      <input type="hidden" name="targetId" value={person.id} />
                      <SubmitButton
                        pendingLabel="처리 중"
                        className="h-8 rounded-full bg-brand px-3 text-xs font-semibold text-brand-contrast"
                      >
                        맞팔로우
                      </SubmitButton>
                    </form>
                  )}
                </li>
              );
            }

            const { reaction } = item;
            return (
              <li key={reaction.id} className={row}>
                <span
                  role="img"
                  aria-label={labelOfReaction(reaction.emoji)}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xl"
                >
                  <ReactionGlyph value={reaction.emoji} doriSize={34} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-semibold">{reaction.user.nickname}</span>
                    <span className="text-muted"> · {reaction.todo.content}</span>
                  </p>
                  <p className="text-xs text-muted">{formatMonthDayKST(reaction.todo.date)}</p>
                </div>
                {newMark}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
