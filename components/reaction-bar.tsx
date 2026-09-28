"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";

import { toggleReaction } from "@/app/(tabs)/feed/actions";
import { Dori } from "@/components/dori";
import { Modal } from "@/components/modal";
import { ReactionGlyph } from "@/components/reaction-glyph";
import { useSaveFailure } from "@/components/use-save-failure";
import {
  DORI_REACTIONS,
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
  compact = false,
}: {
  todoId: string;
  summary: ReactionSummary[];
  // 할 일과 같은 줄에 붙일 때는 칩을 작게 한다.
  compact?: boolean;
}) {
  const chip = compact ? "h-6 px-1.5 text-xs" : "h-7 px-2 text-sm";
  // 도리·이모지 모두 같은 크기 칸에 그린다(reaction-glyph). 칩 높이에 거의 꽉 차게 둔다.
  const glyphSize = compact ? 20 : 24;
  const [picking, setPicking] = useState(false);
  const [, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

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
      try {
        await toggleReaction(formData);
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  function isMine(value: string) {
    return optimistic.some((item) => item.emoji === value && item.mine);
  }

  function pick(value: string) {
    send(value);
    setPicking(false);
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${compact ? "ml-auto max-w-full shrink-0 justify-end" : ""}`}
    >
      {optimistic.map(({ emoji, count, mine }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => send(emoji)}
          aria-label={`${labelOfReaction(emoji)} 반응${mine ? " 취소" : ""}`}
          aria-pressed={mine}
          className={`flex ${chip} items-center gap-1 rounded-full transition-colors active:scale-90 ${
            mine
              ? "bg-brand-subtle text-brand ring-1 ring-brand/40"
              : "bg-surface-hover text-muted"
          }`}
        >
          <ReactionGlyph value={emoji} size={glyphSize} />
          <span className="text-xs font-semibold">{count}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => setPicking(true)}
        aria-label="반응 보내기"
        className={`flex ${chip} items-center rounded-full bg-surface-hover text-muted transition-colors hover:text-foreground active:scale-90 ${compact ? "px-2" : "px-2.5"}`}
      >
        ♡
      </button>

      <Modal
        open={picking}
        onClose={() => setPicking(false)}
        title="반응 보내기"
      >
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted">도리</h3>
          <ul className="grid grid-cols-4 gap-2">
            {DORI_REACTIONS.map(({ value, mood, name, label }) => (
              <li key={value}>
                <PickButton
                  label={label}
                  name={name}
                  mine={isMine(value)}
                  onPick={() => pick(value)}
                >
                  <Dori mood={mood} size={44} />
                </PickButton>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted">이모지</h3>
          <ul className="grid grid-cols-4 gap-2">
            {REACTIONS.map(({ emoji, label }) => (
              <li key={emoji}>
                <PickButton
                  label={label}
                  name={label}
                  mine={isMine(emoji)}
                  onPick={() => pick(emoji)}
                >
                  <span aria-hidden className="text-2xl leading-none">
                    {emoji}
                  </span>
                </PickButton>
              </li>
            ))}
          </ul>
        </section>
      </Modal>
    </div>
  );
}

/** 고르는 창의 칸 하나. 그림 아래에 짧은 이름을 적는다. */
function PickButton({
  label,
  name,
  mine,
  onPick,
  children,
}: {
  label: string;
  name: string;
  mine: boolean;
  onPick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={mine}
      onClick={onPick}
      className={`flex w-full flex-col items-center gap-1 rounded-2xl py-2.5 transition-colors ${
        mine ? "bg-brand-subtle ring-1 ring-brand/40" : "bg-surface-hover"
      }`}
    >
      <span className="flex h-11 items-center justify-center">{children}</span>
      <span className={`text-[11px] ${mine ? "text-brand" : "text-muted"}`}>{name}</span>
    </button>
  );
}
