"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";

import { toggleReaction } from "@/app/(tabs)/feed/actions";
import { DoriFace } from "@/components/avatar";
import { Dori } from "@/components/dori";
import { CHARACTERS, DEFAULT_CHARACTER, type CharacterId } from "@/lib/characters";
import { Modal } from "@/components/modal";
import { ReactionGlyph } from "@/components/reaction-glyph";
import { useSaveFailure } from "@/components/use-save-failure";
import {
  CHARACTER_REACTIONS,
  labelOfReaction,
  REACTIONS,
  type ReactionSummary,
} from "@/lib/reactions";

/**
 * 받은 반응은 이모지 칩으로 쌓인다. 칩을 누르면 누가 눌렀는지 창으로 보여준다(같이 누르는 것이 아니다).
 * 내 반응을 보내거나 취소하는 것은 ♡를 눌러 고르는 창에서 한다.
 *
 * 창에서 고르면 서버 응답을 기다리지 않고 바로 바뀐다. 기다렸다 바꾸면 눌렸는지 몰라
 * 두 번 누르게 되고, 그러면 취소된다.
 */
export function ReactionBar({
  todoId,
  summary,
  others = {},
  compact = false,
}: {
  todoId: string;
  summary: ReactionSummary[];
  // 이모지별로 내가 아닌 사람들의 닉네임(lib/reactions.ts의 othersByEmoji).
  others?: Record<string, string[]>;
  // 할 일과 같은 줄에 붙일 때는 칩을 작게 한다.
  compact?: boolean;
}) {
  const chip = compact ? "h-6 px-1.5 text-xs" : "h-7 px-2 text-sm";
  // 도리·이모지 모두 같은 크기 칸에 그린다(reaction-glyph). 칩 높이에 거의 꽉 차게 둔다.
  const glyphSize = compact ? 20 : 24;
  const [picking, setPicking] = useState(false);
  // 고르는 창에서 보고 있는 캐릭터. 반응으로는 어느 캐릭터든 보낼 수 있다.
  const [tab, setTab] = useState<CharacterId>(DEFAULT_CHARACTER);
  // 누가 눌렀는지 보는 창. 누른 칩의 이모지를 기억해 그 반응을 맨 위에 둔다.
  const [whoOpened, setWhoOpened] = useState<string | null>(null);
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

  const whoList = whoOpened
    ? [...optimistic].sort((a, b) => Number(b.emoji === whoOpened) - Number(a.emoji === whoOpened))
    : optimistic;

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
          onClick={() => setWhoOpened(emoji)}
          aria-label={`${labelOfReaction(emoji)} ${count}개${mine ? ", 내가 누름" : ""}, 누가 눌렀는지 보기`}
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

      <Modal open={whoOpened !== null} onClose={() => setWhoOpened(null)} title="누가 눌렀어요">
        <ul className="flex flex-col gap-3">
          {whoList.map(({ emoji, count, mine }) => (
            <li key={emoji} className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-hover">
                <ReactionGlyph value={emoji} size={28} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-semibold">
                  {labelOfReaction(emoji)} <span className="font-normal text-muted">{count}개</span>
                </p>
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
                  {mine && (
                    // 내가 누른 것은 여기서 "나"를 눌러 취소한다. 칩을 누르는 것은 보기만 한다.
                    <button
                      type="button"
                      onClick={() => {
                        send(emoji);
                        // 이 창에 남은 반응이 없으면 빈 창이 남지 않게 닫는다.
                        if (optimistic.length === 1 && count === 1) setWhoOpened(null);
                      }}
                      aria-label={`${labelOfReaction(emoji)} 내 반응 취소`}
                      className="rounded-full bg-brand-subtle px-2 py-0.5 text-xs font-semibold text-brand ring-1 ring-brand/40 transition-colors active:scale-95"
                    >
                      나 · 취소
                    </button>
                  )}
                  <span>{(others[emoji] ?? []).join(", ") || (mine ? "" : "지운 계정")}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={picking}
        onClose={() => setPicking(false)}
        title="반응 보내기"
      >
        <section className="flex flex-col gap-2">
          <div role="tablist" aria-label="캐릭터" className="flex gap-2">
            {CHARACTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                aria-label={item.name}
                onClick={() => setTab(item.id)}
                className={`rounded-full p-1 transition-colors ${tab === item.id ? "bg-brand-subtle ring-2 ring-brand" : "bg-surface-hover"}`}
              >
                <DoriFace size={40} character={item.id} className="rounded-full" />
              </button>
            ))}
          </div>
          <ul role="tabpanel" aria-label={CHARACTERS.find((item) => item.id === tab)?.name} className="grid grid-cols-5 gap-2">
            {CHARACTER_REACTIONS.filter((reaction) => reaction.character === tab).map(({ value, mood, character, label }) => (
              <li key={value}>
                <PickButton label={label} mine={isMine(value)} onPick={() => pick(value)}>
                  <Dori mood={mood} character={character} size={46} />
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

/** 고르는 창의 칸 하나. 이모지는 그림 아래에 짧은 이름을 적고, 캐릭터 표정은 이름을 붙이지 않는다. */
function PickButton({
  label,
  name,
  mine,
  onPick,
  children,
}: {
  label: string;
  name?: string;
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
      {name && <span className={`text-[11px] ${mine ? "text-brand" : "text-muted"}`}>{name}</span>}
    </button>
  );
}
