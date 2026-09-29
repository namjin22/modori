import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { DoriMessage } from "@/components/dori-message";
import { SubmitButton } from "@/components/submit-button";
import { avatarUrl } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { followUser } from "../../actions";

export type FollowListKind = "following" | "followers";

const TITLES: Record<FollowListKind, string> = { following: "팔로우", followers: "팔로워" };

/**
 * 친구가 팔로우하는 사람 / 친구를 팔로우하는 사람. 친구 화면과 같이 내가 팔로우한 사람만 볼 수 있다.
 * 목록 속 사람은 내가 팔로우한 사람이면 그 사람 화면으로 잇고, 아니면 그 자리에서 팔로우한다
 * (친구 화면은 팔로우한 사람만 열린다).
 */
export async function FriendFollowList({ id, kind }: { id: string; kind: FollowListKind }) {
  const viewer = await requireUser();
  const friend = await prisma.user.findFirst({
    where: { id, nickname: { not: null }, followers: { some: { followerId: viewer.id } } },
    select: { id: true, nickname: true },
  });
  if (!friend) notFound();

  const [rows, myFollowing] = await Promise.all([
    kind === "following"
      ? prisma.follow
          .findMany({
            where: { followerId: friend.id, following: { nickname: { not: null } } },
            orderBy: { createdAt: "desc" },
            select: { following: { select: { id: true, nickname: true, profileImage: true } } },
          })
          .then((list) => list.map((row) => row.following))
      : prisma.follow
          .findMany({
            where: { followingId: friend.id, follower: { nickname: { not: null } } },
            orderBy: { createdAt: "desc" },
            select: { follower: { select: { id: true, nickname: true, profileImage: true } } },
          })
          .then((list) => list.map((row) => row.follower)),
    prisma.follow.findMany({ where: { followerId: viewer.id }, select: { followingId: true } }),
  ]);
  const following = new Set(myFollowing.map((follow) => follow.followingId));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex min-w-0 items-center gap-1">
        <BackLink href={`/feed/u/${friend.id}`} label={`${friend.nickname} 화면으로`} />
        <h1 className="min-w-0 truncate text-2xl font-bold">
          {friend.nickname}의 {TITLES[kind]}
        </h1>
      </header>

      {rows.length === 0 ? (
        <DoriMessage mood="calm">
          <p>{kind === "following" ? "아직 팔로우한 사람이 없어요" : "아직 팔로워가 없어요"}</p>
        </DoriMessage>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((person) => {
            const me = person.id === viewer.id;
            const followed = following.has(person.id);
            const face = (
              <>
                <Avatar src={avatarUrl(person)} size={36} />
                <span className="truncate font-medium">{person.nickname}</span>
              </>
            );
            return (
              <li key={person.id} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
                {followed ? (
                  <Link prefetch={false} href={`/feed/u/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    {face}
                  </Link>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-3">{face}</span>
                )}

                {me ? (
                  <span className="shrink-0 text-sm text-muted">나</span>
                ) : followed ? (
                  <span className="shrink-0 text-sm text-muted">팔로우 중</span>
                ) : (
                  <form action={followUser} className="shrink-0">
                    <input type="hidden" name="targetId" value={person.id} />
                    <SubmitButton
                      pendingLabel="처리 중"
                      className="h-9 rounded-full bg-brand px-4 text-sm font-semibold text-brand-contrast"
                    >
                      팔로우
                    </SubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
