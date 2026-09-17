"use client";

import { useOptimistic } from "react";

import { toggleReaction } from "@/app/(tabs)/feed/actions";
import { Dori } from "@/components/dori";
import {
  REACTION_LOOKS,
  type ReactionEmoji,
  type ReactionSummary,
} from "@/lib/reactions";

/**
 * 반응을 누르면 서버 응답을 기다리지 않고 바로 바뀐다.
 * 기다렸다 바꾸면 눌렀는지 안 눌렀는지 몰라 두 번 누르게 되고, 그러면 취소된다.
 */
export function ReactionBar({
  todoId,
  summary,
}: {
  todoId: string;
  summary: ReactionSummary[];
}) {
  const [optimistic, toggle] = useOptimistic(
    summary,
    (current, emoji: ReactionEmoji) =>
      current.map((item) =>
        item.emoji === emoji
          ? {
              ...item,
              mine: !item.mine,
              count: item.count + (item.mine ? -1 : 1),
            }
          : item,
      ),
  );

  return (
    <div className="flex flex-wrap gap-0.5">
      {optimistic.map(({ emoji, count, mine }) => (
        <form
          key={emoji}
          action={async (formData: FormData) => {
            toggle(emoji);
            await toggleReaction(formData);
          }}
        >
          <input type="hidden" name="todoId" value={todoId} />
          <input type="hidden" name="emoji" value={emoji} />
          <button
            type="submit"
            aria-label={`${emoji} 반응${mine ? " 취소" : ""}`}
            title={REACTION_LOOKS[emoji].label}
            aria-pressed={mine}
            className={`flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-sm transition-colors active:scale-90 ${
              mine
                ? "bg-brand-subtle text-brand ring-1 ring-brand/40"
                : "bg-surface-hover text-muted"
            }`}
          >
            <Dori mood={REACTION_LOOKS[emoji].mood} size={24} />
            <span className="text-[11px]">{REACTION_LOOKS[emoji].label}</span>
            {count > 0 && <span className="text-xs font-semibold">{count}</span>}
          </button>
        </form>
      ))}
    </div>
  );
}
