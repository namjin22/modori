import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { SubmitButton } from "@/components/submit-button";

import { followUser, unfollowUser } from "../actions";

const MAX_RESULTS = 20;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [results, following] = await Promise.all([
    query.length > 0
      ? prisma.user.findMany({
          where: {
            id: { not: user.id },
            nickname: { contains: query, mode: "insensitive" },
          },
          orderBy: { nickname: "asc" },
          take: MAX_RESULTS,
          select: { id: true, nickname: true, profileEmoji: true },
        })
      : Promise.resolve([]),
    prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    }),
  ]);

  const followingIds = new Set(following.map((row) => row.followingId));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link href="/feed" aria-label="소셜로" className="text-muted">
          ←
        </Link>
        <h1 className="text-2xl font-bold">친구 찾기</h1>
      </header>

      <form className="flex gap-2 rounded-2xl bg-surface p-3">
        <input
          name="q"
          defaultValue={query}
          placeholder="닉네임"
          aria-label="닉네임 검색"
          className="h-11 min-w-0 flex-1 rounded-xl bg-surface-hover px-3"
        />
        <SubmitButton
          pendingLabel="찾는 중"
          className="h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast"
        >
          검색
        </SubmitButton>
      </form>

      {query.length === 0 ? (
        <p className="rounded-2xl bg-surface p-10 text-center text-sm text-muted">
          닉네임을 입력해서 찾는다
        </p>
      ) : results.length === 0 ? (
        <p className="rounded-2xl bg-surface p-10 text-center text-sm text-muted">
          {query}에 맞는 사람이 없다
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((person) => {
            const isFollowing = followingIds.has(person.id);

            return (
              <li
                key={person.id}
                className="flex items-center gap-3 rounded-2xl bg-surface p-3"
              >
                <span className="text-xl">{person.profileEmoji}</span>
                <span className="flex-1 truncate font-medium">
                  {person.nickname}
                </span>

                <form action={isFollowing ? unfollowUser : followUser}>
                  <input type="hidden" name="targetId" value={person.id} />
                  <SubmitButton
                    pendingLabel="처리 중"
                    className={`h-9 rounded-full px-4 text-sm font-medium ${
                      isFollowing
                        ? "bg-surface-hover text-muted"
                        : "bg-brand text-brand-contrast"
                    }`}
                  >
                    {isFollowing ? "팔로우 중" : "팔로우"}
                  </SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
