import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { SubmitButton } from "@/components/submit-button";

import { unfollowUser } from "../actions";

export default async function FollowingPage() {
  const user = await requireUser();

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      following: { select: { id: true, nickname: true, profileEmoji: true } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link href="/feed" aria-label="피드로" className="text-muted">
          ←
        </Link>
        <h1 className="text-2xl font-bold">팔로우 중</h1>
      </header>

      {following.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted">아직 팔로우한 친구가 없다</p>
          <Link
            href="/feed/search"
            className="mt-3 inline-block text-sm text-brand"
          >
            닉네임으로 찾아보기
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {following.map(({ following: person }) => (
            <li
              key={person.id}
              className="flex items-center gap-3 rounded-2xl bg-surface p-3"
            >
              <span className="text-xl">{person.profileEmoji}</span>
              <span className="flex-1 truncate font-medium">
                {person.nickname}
              </span>

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
