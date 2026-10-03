import Link from "next/link";

import { MAX_NICKNAME_LENGTH, normalizeNickname } from "@/lib/nickname";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { SubmitButton } from "@/components/submit-button";

import { followUser, unfollowUser } from "../actions";

import { Avatar } from "@/components/avatar";
import { DoriMessage } from "@/components/dori-message";
import { BackLink } from "@/components/back-link";
import { avatarUrl } from "@/lib/avatar";

const MAX_RESULTS = 20;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  // 닉네임과 같은 규칙으로 정리한다. 맥에서 친 한글(NFD)도 찾히고, 닉네임보다 긴 검색어는 자른다.
  const query = normalizeNickname(q).slice(0, MAX_NICKNAME_LENGTH);

  const [results, following] = await Promise.all([
    query.length > 0
      ? prisma.user.findMany({
          where: {
            id: { not: user.id },
            nickname: { contains: query, mode: "insensitive" },
          },
          orderBy: { nickname: "asc" },
          take: MAX_RESULTS,
          select: { id: true, nickname: true, profileImage: true, avatarCharacter: true },
        })
      : Promise.resolve([]),
    prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    }),
  ]);

  const followingIds = new Set(following.map((row) => row.followingId));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/feed" label="소셜로" />
        <h1 className="text-2xl font-bold">친구 찾기</h1>
      </header>

      <form className="flex gap-2 rounded-2xl bg-surface p-4">
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
        <DoriMessage mood="happy">
          <p>닉네임으로 찾아보세요</p>
        </DoriMessage>
      ) : results.length === 0 ? (
        <DoriMessage mood="confused">
          <p>{query}에 맞는 사람이 없어요</p>
        </DoriMessage>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map((person) => {
            const isFollowing = followingIds.has(person.id);

            return (
              <li
                key={person.id}
                className="flex items-center gap-3 rounded-2xl bg-surface p-4"
              >
                {/* 팔로우하지 않은 사람의 화면은 "팔로우하면 볼 수 있어요" 안내가 뜬다. */}
                <Link prefetch={false}
                  href={`/feed/u/${person.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <Avatar src={avatarUrl(person)} size={36} />
                  <span className="truncate font-medium">
                    {person.nickname}
                  </span>
                </Link>

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
