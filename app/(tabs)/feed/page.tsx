import Link from "next/link";

import { formatMonthDayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { countUnreadReactions, requireUser } from "@/lib/session";

import { Dori } from "@/components/dori";
import { FeedItem } from "@/components/feed-item";

const FEED_SIZE = 50;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string }>;
}) {
  const user = await requireUser();
  const { after } = await searchParams;

  const [page, followingCount, unreadCount] = await Promise.all([
    // 팔로우한 사람이 완료한 할 일 중 공개 카테고리만.
    // 카테고리를 고르지 않은 할 일은 공개 여부를 정한 적이 없으므로 내보내지 않는다.
    prisma.todo.findMany({
      where: {
        done: true,
        category: { isPublic: true },
        user: { followers: { some: { followerId: user.id } } },
      },
      // 같은 순간에 완료한 할 일이 여럿일 수 있어 id로 순서를 확정한다.
      // 그러지 않으면 다음 쪽에서 같은 항목이 다시 나오거나 빠진다.
      orderBy: [{ doneAt: "desc" }, { id: "desc" }],
      // 한 개 더 불러서 다음 쪽이 있는지 본다. 전체 개수를 세는 것보다 싸다.
      take: FEED_SIZE + 1,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, nickname: true, profileEmoji: true } },
        category: { select: { name: true, color: true } },
        reactions: { select: { emoji: true, userId: true } },
      },
    }),
    prisma.follow.count({ where: { followerId: user.id } }),
    // 레이아웃이 같은 값을 이미 셌다. cache()가 막아주므로 질의는 한 번이다.
    countUnreadReactions(user.id, user.lastSeenAt),
  ]);

  const hasMore = page.length > FEED_SIZE;
  const todos = hasMore ? page.slice(0, FEED_SIZE) : page;
  const nextCursor = hasMore ? todos[todos.length - 1].id : null;

  return (
    <div className="flex flex-col gap-5">
      {/* 셋을 한 줄에 붙여두니 글씨도 작고 손가락으로 누르기도 어려웠다.
          자주 쓰는 "친구 찾기"만 제목 옆에 두고, 나머지는 아래에 칩으로 편다. */}
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">소셜</h1>
          <Link
            href="/feed/search"
            className="h-9 rounded-full bg-brand px-4 text-sm font-semibold leading-9 text-brand-contrast"
          >
            친구 찾기
          </Link>
        </div>

        <div className="flex gap-2">
          <Link
            href="/feed/reactions"
            className="flex h-9 items-center gap-1.5 rounded-full bg-surface px-4 text-sm text-muted"
          >
            받은 반응
            {unreadCount > 0 && (
              <span className="rounded-full bg-brand px-1.5 text-xs font-semibold text-brand-contrast">
                {unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/feed/following"
            className="flex h-9 items-center rounded-full bg-surface px-4 text-sm text-muted"
          >
            팔로우 중 {followingCount}
          </Link>
        </div>
      </header>

      {todos.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-surface p-8 text-center">
          <Dori mood={followingCount === 0 ? "hello" : "calm"} size={88} className="mb-2" />
          <p className="text-sm text-muted">
            {after
              ? "더 이전 기록은 없다"
              : followingCount === 0
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
                date: formatMonthDayKST(todo.date),
                user: todo.user,
                color: todo.color,
                category: todo.category,
                reactions: todo.reactions,
              }}
              viewerId={user.id}
            />
          ))}
        </ul>
      )}

      {(nextCursor || after) && (
        <div className="flex items-center justify-between">
          {after ? (
            <Link href="/feed" className="text-sm text-muted">
              ↑ 최근으로
            </Link>
          ) : (
            <span />
          )}
          {nextCursor && (
            <Link
              href={`/feed?after=${nextCursor}`}
              className="text-sm font-medium text-brand"
            >
              더 보기 →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
