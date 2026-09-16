import Link from "next/link";

import { formatKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { FeedItem } from "@/components/feed-item";

const FEED_SIZE = 50;

export default async function FeedPage() {
  const user = await requireUser();

  const [todos, followingCount, unreadCount] = await Promise.all([
    // 팔로우한 사람이 완료한 할 일 중 공개 카테고리만.
    // 카테고리를 고르지 않은 할 일은 공개 여부를 정한 적이 없으므로 내보내지 않는다.
    prisma.todo.findMany({
      where: {
        done: true,
        category: { isPublic: true },
        user: { followers: { some: { followerId: user.id } } },
      },
      orderBy: { doneAt: "desc" },
      take: FEED_SIZE,
      include: {
        user: { select: { id: true, nickname: true, profileEmoji: true } },
        category: { select: { name: true, color: true } },
        reactions: { select: { emoji: true, userId: true } },
      },
    }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.reaction.count({
      where: {
        todo: { userId: user.id },
        userId: { not: user.id },
        createdAt: { gt: user.lastSeenAt },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">피드</h1>

        <div className="flex items-center gap-3">
          <Link href="/feed/reactions" className="text-sm text-muted">
            받은 반응
            {unreadCount > 0 && (
              <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-xs font-semibold text-brand-contrast">
                {unreadCount}
              </span>
            )}
          </Link>
          <Link href="/feed/following" className="text-sm text-muted">
            팔로우 중 {followingCount}
          </Link>
          <Link href="/feed/search" className="text-sm text-brand">
            친구 찾기
          </Link>
        </div>
      </header>

      {todos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted">
            {followingCount === 0
              ? "아직 팔로우한 친구가 없다"
              : "친구들이 아직 완료한 할 일이 없다"}
          </p>
          {followingCount === 0 && (
            <Link
              href="/feed/search"
              className="mt-3 inline-block text-sm text-brand"
            >
              닉네임으로 찾아보기
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {todos.map((todo) => (
            <FeedItem
              key={todo.id}
              todo={{
                id: todo.id,
                content: todo.content,
                date: formatKST(todo.date),
                user: todo.user,
                category: todo.category,
                reactions: todo.reactions,
              }}
              viewerId={user.id}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
