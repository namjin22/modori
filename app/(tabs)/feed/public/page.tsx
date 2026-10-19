import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/avatar";
import { DoriMessage } from "@/components/dori-message";
import { PostComposer } from "@/components/post-composer";
import { PostDeleteButton } from "@/components/post-delete-button";
import { ReactionBar } from "@/components/reaction-bar";
import { SafetyMenu } from "@/components/safety-menu";
import { SocialTabs } from "@/components/social-tabs";
import { avatarUrl } from "@/lib/avatar";
import { dateIn, formatMonthDayKST, todayIn } from "@/lib/date";
import { onColorText } from "@/lib/colors";
import { prisma } from "@/lib/prisma";
import { canSeePublicFeed, visiblePostsWhere } from "@/lib/public-feed";
import { POSTS_PAGE } from "@/lib/public-feed-limits";
import { othersByEmoji, summarizeReactions } from "@/lib/reactions";
import { requireUser } from "@/lib/session";

import { togglePostReaction } from "./actions";

export const metadata: Metadata = { title: "피드 · 모도리" };

/** "createdAt(ms)_id". 같은 시각의 글이 있어도 빠지거나 겹치지 않게 id까지 쓴다. */
function readCursor(raw: string | undefined): { at: Date; id: string } | null {
  if (!raw) return null;
  const [ms, id] = raw.split("_");
  const at = new Date(Number(ms));
  return id && !Number.isNaN(at.getTime()) ? { at, id } : null;
}

/**
 * 공개 피드(2026-10-19): 모도리 사용자 누구나 올린 "끝낸 할 일 + 짧은 글"을 최신순으로 본다. 반응은 이모지만, 사진·댓글은 없다.
 * 서로 차단한 사람의 글과 운영자가 숨긴 글은 보이지 않는다. 열리기 전에는 운영자만 본다(lib/public-feed.ts).
 */
export default async function PublicFeedPage({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  const user = await requireUser();
  if (!(await canSeePublicFeed(user.id))) redirect("/feed");
  const cursor = readCursor((await searchParams).after);
  const today = todayIn(user.timezone);

  const [doneToday, page] = await Promise.all([
    prisma.todo.findMany({
      where: { userId: user.id, date: today, done: true },
      orderBy: { doneAt: "desc" },
      select: { id: true, content: true, color: true, category: { select: { color: true } } },
    }),
    prisma.post.findMany({
      where: {
        ...visiblePostsWhere(user.id),
        ...(cursor && { OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }] }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: POSTS_PAGE + 1,
      select: {
        id: true,
        body: true,
        todoContent: true,
        todoColor: true,
        createdAt: true,
        user: { select: { id: true, nickname: true, profileImage: true, avatarCharacter: true } },
        reactions: { select: { emoji: true, userId: true, user: { select: { nickname: true } } }, orderBy: { createdAt: "asc" } },
      },
    }),
  ]);
  const hasMore = page.length > POSTS_PAGE;
  const posts = hasMore ? page.slice(0, POSTS_PAGE) : page;
  const last = posts[posts.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">소셜</h1>
        <Link
          prefetch={false}
          href="/feed/search"
          className="h-9 rounded-full bg-brand px-4 text-sm font-semibold leading-9 text-brand-contrast"
        >
          친구 찾기
        </Link>
      </header>
      <SocialTabs active="public" />

      <PostComposer
        todos={doneToday.map((todo) => ({ id: todo.id, content: todo.content, color: todo.color ?? todo.category?.color ?? null }))}
      />

      {posts.length === 0 ? (
        <DoriMessage mood="hello">
          <p>아직 올라온 글이 없어요</p>
          <p className="text-xs">오늘 끝낸 일을 처음으로 나눠 보세요</p>
        </DoriMessage>
      ) : (
        <ul aria-label="피드 글" className="flex flex-col gap-3">
          {posts.map((post) => {
            const mine = post.user.id === user.id;
            const color = post.todoColor ?? "#2563eb";
            return (
              <li key={post.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
                <div className="flex items-center gap-2">
                  <Link prefetch={false} href={`/feed/u/${post.user.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                    <Avatar src={avatarUrl(post.user)} size={32} />
                    <span className="truncate text-sm font-semibold">{post.user.nickname}</span>
                    <span className="shrink-0 text-xs text-muted">{formatMonthDayKST(dateIn(post.createdAt, user.timezone))}</span>
                  </Link>
                  {mine ? (
                    <PostDeleteButton postId={post.id} />
                  ) : (
                    <SafetyMenu targetId={post.user.id} nickname={post.user.nickname ?? ""} postId={post.id} />
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="color-edge flex size-5 shrink-0 items-center justify-center rounded-[6px] text-[11px] font-bold"
                    style={{ backgroundColor: color, color: onColorText(color) }}
                  >
                    ✓
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{post.todoContent}</span>
                </div>
                {post.body && <p className="whitespace-pre-line wrap-break-word text-[15px]">{post.body}</p>}
                <ReactionBar
                  todoId={post.id}
                  summary={summarizeReactions(post.reactions, user.id)}
                  others={othersByEmoji(post.reactions, user.id)}
                  onToggle={togglePostReaction.bind(null, post.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && last && (
        <Link
          prefetch={false}
          href={`/feed/public?after=${last.createdAt.getTime()}_${last.id}`}
          className="flex h-11 items-center justify-center rounded-2xl bg-surface text-sm text-muted hover:text-foreground"
        >
          이전 글 더 보기
        </Link>
      )}
    </div>
  );
}
