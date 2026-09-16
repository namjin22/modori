import Link from "next/link";

import { toggleReaction } from "@/app/(tabs)/feed/actions";
import { REACTION_EMOJIS } from "@/lib/reactions";

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

      <div className="flex items-center gap-2">
        {todo.category && (
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: todo.category.color }}
          />
        )}
        <span className="min-w-0 flex-1 truncate">{todo.content}</span>
      </div>

      <div className="flex gap-1">
        {REACTION_EMOJIS.map((emoji) => {
          const count = todo.reactions.filter(
            (reaction) => reaction.emoji === emoji,
          ).length;
          const mine = todo.reactions.some(
            (reaction) => reaction.emoji === emoji && reaction.userId === viewerId,
          );

          return (
            <form key={emoji} action={toggleReaction}>
              <input type="hidden" name="todoId" value={todo.id} />
              <input type="hidden" name="emoji" value={emoji} />
              <button
                type="submit"
                aria-label={`${emoji} 반응${mine ? " 취소" : ""}`}
                aria-pressed={mine}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm transition-colors ${
                  mine
                    ? "bg-brand-subtle text-brand"
                    : "bg-surface-hover text-muted"
                }`}
              >
                <span>{emoji}</span>
                {count > 0 && <span className="text-xs">{count}</span>}
              </button>
            </form>
          );
        })}
      </div>
    </li>
  );
}
