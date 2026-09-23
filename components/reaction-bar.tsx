"use client";

import { useOptimistic, useState, useTransition } from "react";

import { toggleReaction } from "@/app/(tabs)/feed/actions";
import { Modal } from "@/components/modal";
import {
  labelOfReaction,
  REACTIONS,
  type ReactionSummary,
} from "@/lib/reactions";

/**
 * 받은 반응은 이모지 칩으로 쌓이고, 새로 보낼 때는 +를 눌러 고른다.
 *
 * 누르면 서버 응답을 기다리지 않고 바로 바뀐다. 기다렸다 바꾸면 눌렸는지 몰라
 * 두 번 누르게 되고, 그러면 취소된다.
 */
export function ReactionBar({
  todoId,
  summary,
}: {
  todoId: string;
  summary: ReactionSummary[];
}) {
  const [picking, setPicking] = useState(false);
  const [, startTransition] = useTransition();

  const [optimistic, apply] = useOptimistic(
    summary,
    (current, emoji: string) => {
      const found = current.find((item) => item.emoji === emoji);
      if (!found) return [...current, { emoji, count: 1, mine: true }];

      return current
        .map((item) =>
          item.emoji === emoji
            ? {
                ...item,
                mine: !item.mine,
                count: item.count + (item.mine ? -1 : 1),
              }
            : item,
        )
        .filter((item) => item.count > 0);
    },
  );

  function send(emoji: string) {
    startTransition(async () => {
      apply(emoji);
      const formData = new FormData();
      formData.set("todoId", todoId);
      formData.set("emoji", emoji);
      await toggleReaction(formData);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {optimistic.map(({ emoji, count, mine }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => send(emoji)}
          aria-label={`${labelOfReaction(emoji)} 반응${mine ? " 취소" : ""}`}
          aria-pressed={mine}
          className={`flex h-7 items-center gap-1 rounded-full px-2 text-sm transition-colors active:scale-90 ${
            mine
              ? "bg-brand-subtle text-brand ring-1 ring-brand/40"
              : "bg-surface-hover text-muted"
          }`}
        >
          <span aria-hidden>{emoji}</span>
          <span className="text-xs font-semibold">{count}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => setPicking(true)}
        aria-label="반응 보내기"
        className="flex h-7 items-center rounded-full bg-surface-hover px-2.5 text-sm text-muted transition-colors hover:text-foreground active:scale-90"
      >
        ♡
      </button>

      <Modal
        open={picking}
        onClose={() => setPicking(false)}
        title="반응 보내기"
      >
        <ul className="grid grid-cols-4 gap-2">
          {REACTIONS.map(({ emoji, label }) => {
            const mine = optimistic.some(
              (item) => item.emoji === emoji && item.mine,
            );

            return (
              <li key={emoji}>
                <button
                  type="button"
                  aria-label={label}
                  aria-pressed={mine}
                  onClick={() => {
                    send(emoji);
                    setPicking(false);
                  }}
                  className={`flex w-full flex-col items-center gap-1 rounded-2xl py-3 transition-colors ${
                    mine ? "bg-brand-subtle ring-1 ring-brand/40" : "bg-surface-hover"
                  }`}
                >
                  <span aria-hidden className="text-2xl leading-none">
                    {emoji}
                  </span>
                  <span
                    className={`text-[11px] ${mine ? "text-brand" : "text-muted"}`}
                  >
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>
    </div>
  );
}
