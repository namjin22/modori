import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { SubmitButton } from "@/components/submit-button";

import { unfollowUser } from "../actions";

import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";

export default async function FollowingPage() {
  const user = await requireUser();

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      following: { select: { id: true, nickname: true, profileImage: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/feed" label="소셜로" />
        <h1 className="text-2xl font-bold">팔로우 중</h1>
      </header>

      {following.length === 0 ? (
        <div className="rounded-2xl bg-surface p-10 text-center">
          <p className="text-sm text-muted">아직 팔로우한 친구가 없어요</p>
          <Link
            href="/feed/search"
            className="mt-3 inline-block text-sm text-brand"
          >
            닉네임으로 찾아보기
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {following.map(({ following: person }) => (
            <li
              key={person.id}
              className="flex items-center gap-3 rounded-2xl bg-surface p-4"
            >
              <Link
                href={`/feed/u/${person.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Avatar src={person.profileImage} size={36} />
                <span className="truncate font-medium">{person.nickname}</span>
              </Link>

              <form action={unfollowUser}>
                <input type="hidden" name="targetId" value={person.id} />
                <SubmitButton
                  pendingLabel="처리 중"
                  className="h-9 rounded-full bg-surface-hover px-4 text-sm text-muted"
                >
                  언팔로우
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
