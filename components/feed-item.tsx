import Link from "next/link";

import { ReactionBar } from "@/components/reaction-bar";
import { summarizeReactions } from "@/lib/reactions";

type FeedTodo = {
  id: string;
  content: string;
  date: string;
  user: { id: string; nickname: string | null; profileEmoji: string };
  category: { name: string; color: string } | null;
  reactions: { emoji: string; userId: string }[];
};

export function FeedItem({
  todo,
  viewerId,
  showAuthor = true,
}: {
  todo: FeedTodo;
  viewerId: string;
  // 그 사람 화면에서는 이름과 날짜가 이미 위에 있다. 줄마다 반복하지 않는다.
  showAuthor?: boolean;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      {showAuthor && (
        <div className="flex items-center gap-2">
          <Link
            href={`/feed/u/${todo.user.id}`}
            className="flex min-w-0 items-center gap-2"
          >
            <span className="text-lg">{todo.user.profileEmoji}</span>
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
            todo.category ? { backgroundColor: todo.category.color } : undefined
          }
        >
          ✓
        </span>
        <span className="min-w-0 flex-1 truncate">{todo.content}</span>
        {todo.category && (
          <span
            className="shrink-0 text-xs font-medium"
            style={{ color: todo.category.color }}
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
