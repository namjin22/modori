import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { DoriMessage } from "@/components/dori-message";
import { RemoveFollowerButton } from "@/components/remove-follower-button";
import { SubmitButton } from "@/components/submit-button";

import { followUser } from "../actions";

import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { avatarUrl } from "@/lib/avatar";

/**
 * 나를 팔로우하는 사람. 마이페이지의 팔로워 수를 누르면 온다. 원하지 않는 사람은 "끊기"로 뺀다.
 * 친구 화면(/feed/u/[id])은 내가 팔로우한 사람만 볼 수 있어서, 아직 팔로우하지 않은
 * 사람은 이름에 링크를 걸지 않고 맞팔로우 버튼을 둔다.
 */
export default async function FollowersPage() {
  const user = await requireUser();

  const [followers, myFollowing] = await Promise.all([
    prisma.follow.findMany({
      where: { followingId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        follower: { select: { id: true, nickname: true, profileImage: true, avatarCharacter: true } },
      },
    }),
    prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    }),
  ]);
  const following = new Set(myFollowing.map((follow) => follow.followingId));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/settings" label="마이페이지로" />
        <h1 className="text-2xl font-bold">팔로워</h1>
      </header>

      {followers.length === 0 ? (
        <DoriMessage mood="calm">
          <p>아직 나를 팔로우한 친구가 없어요</p>
        </DoriMessage>
      ) : (
        <ul className="flex flex-col gap-3">
          {followers.map(({ follower: person }) => {
            const isFollowing = following.has(person.id);
            const face = (
              <>
                <Avatar src={avatarUrl(person)} size={36} />
                <span className="truncate font-medium">{person.nickname}</span>
              </>
            );

            return (
              // 좁은 폰에서 버튼 둘이 이름을 몇 글자만 남기면 버튼을 이름 아래 줄로 내린다.
              <li
                key={person.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-surface p-4"
              >
                {isFollowing ? (
                  <Link
                    prefetch={false}
                    href={`/feed/u/${person.id}`}
                    className="flex min-w-0 grow basis-40 items-center gap-3"
                  >
                    {face}
                  </Link>
                ) : (
                  <div className="flex min-w-0 grow basis-40 items-center gap-3">{face}</div>
                )}

                <div className="ml-auto flex items-center gap-1">
                {isFollowing ? (
                  <span className="shrink-0 px-2 text-sm text-muted">팔로우 중</span>
                ) : (
                  <form action={followUser}>
                    <input type="hidden" name="targetId" value={person.id} />
                    <SubmitButton
                      pendingLabel="처리 중"
                      className="h-9 rounded-full bg-brand px-4 text-sm font-semibold text-brand-contrast"
                    >
                      맞팔로우
                    </SubmitButton>
                  </form>
                )}

                <RemoveFollowerButton id={person.id} nickname={person.nickname ?? ""} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
