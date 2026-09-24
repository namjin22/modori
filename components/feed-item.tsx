import Link from "next/link";

import { ReactionBar } from "@/components/reaction-bar";
import { onColorText } from "@/lib/colors";
import { summarizeReactions } from "@/lib/reactions";

import { Avatar } from "@/components/avatar";

type FeedTodo = {
  id: string;
  content: string;
  date: string;
  // 사진은 주소(avatarUrl)로 받는다. 한 줄 모양에서는 그리지 않아서 없어도 된다.
  user: { id: string; nickname: string | null; avatar?: string | null };
  color: string | null;
  category: { name: string; color: string } | null;
  reactions: { emoji: string; userId: string }[];
};

export function FeedItem({
  todo,
  viewerId,
  showAuthor = true,
  compact = false,
}: {
  todo: FeedTodo;
  viewerId: string;
  // 그 사람 화면에서는 이름과 날짜가 이미 위에 있다. 줄마다 반복하지 않는다.
  showAuthor?: boolean;
  // 친구 화면처럼 카테고리로 이미 묶인 곳에서는 한 줄로 줄여 한눈에 많이 보이게 한다.
  compact?: boolean;
}) {
  const color = todo.color ?? todo.category?.color;

  if (compact) {
    return (
      <li className="flex items-center gap-2.5 py-2.5">
        <span
          aria-hidden
          className="color-edge flex size-[18px] shrink-0 items-center justify-center rounded-[6px] bg-brand text-[10px] font-bold"
          style={
            color ? { backgroundColor: color, color: onColorText(color) } : { color: "#fff" }
          }
        >
          ✓
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px]">{todo.content}</span>
        <ReactionBar
          todoId={todo.id}
          summary={summarizeReactions(todo.reactions, viewerId)}
          compact
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-4 rounded-2xl bg-surface p-4">
      {showAuthor && (
        <div className="flex items-center gap-2">
          <Link prefetch={false}
            href={`/feed/u/${todo.user.id}`}
            className="flex min-w-0 items-center gap-2"
          >
            <Avatar src={todo.user.avatar ?? null} size={32} />
            <span className="truncate text-sm font-semibold">
              {todo.user.nickname}
            </span>
          </Link>
          <span className="text-xs text-muted">{todo.date}</span>
        </div>
      )}

      {/* 피드에는 완료한 일만 온다. 오늘 화면의 체크와 같은 모양으로 보여준다. */}
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white"
          style={
            todo.color || todo.category
              ? { backgroundColor: todo.color ?? todo.category?.color }
              : undefined
          }
        >
          ✓
        </span>
        <span className="min-w-0 flex-1 truncate">{todo.content}</span>
        {todo.category && (
          <span
            className="shrink-0 text-xs font-medium"
            style={{ color: todo.color ?? todo.category.color }}
          >
            {todo.category.name}
          </span>
        )}
      </div>

      <ReactionBar
        todoId={todo.id}
        summary={summarizeReactions(todo.reactions, viewerId)}
      />
    </li>
  );
}
