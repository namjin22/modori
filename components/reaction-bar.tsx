"use client";

import { useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";

import { toggleReaction } from "@/app/(tabs)/feed/actions";
import { Dori } from "@/components/dori";
import { CHARACTERS, DEFAULT_CHARACTER, type CharacterId } from "@/lib/characters";
import { Modal } from "@/components/modal";
import { ReactionGlyph } from "@/components/reaction-glyph";
import { useSaveFailure } from "@/components/use-save-failure";
import { useBump } from "@/lib/motion";
import {
  CHARACTER_REACTIONS,
  labelOfReaction,
  REACTIONS,
  type ReactionSummary,
} from "@/lib/reactions";

const EMOJI_TAB = "emoji";

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
  onToggle,
}: {
  // 할 일이 아닌 곳(피드 글)의 반응은 이 함수로 보낸다(app/(tabs)/feed/public/actions.ts). 없으면 할 일 반응이다.
  onToggle?: (emoji: string) => Promise<void>;
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
  const [tab, setTab] = useState<CharacterId | typeof EMOJI_TAB>(DEFAULT_CHARACTER);
  // 누가 눌렀는지 보는 창. 누른 칩의 이모지를 기억해 그 반응을 맨 위에 둔다.
  const [whoOpened, setWhoOpened] = useState<string | null>(null);
  const [initialEmojis] = useState(() => new Set(summary.map((item) => item.emoji)));
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
        await (onToggle ? onToggle(emoji) : toggleReaction(formData));
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
        <ReactionChip
          key={emoji}
          count={count}
          // 처음 그릴 때 있던 칩은 가만히 두고, 방금 보낸 반응의 칩만 통 튀어 나온다.
          fresh={!initialEmojis.has(emoji)}
          onClick={() => setWhoOpened(emoji)}
          aria-label={`${labelOfReaction(emoji)} ${count}개${mine ? ", 내가 누름" : ""}, 누가 눌렀는지 보기`}
          className={`flex ${chip} items-center gap-1 rounded-full transition-colors active:scale-90 ${
            mine
              ? "bg-brand-subtle text-brand ring-1 ring-brand/40"
              : "bg-surface-hover text-muted"
          }`}
        >
          <ReactionGlyph value={emoji} size={glyphSize} />
        </ReactionChip>
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
                {/* 반응의 이름("펭이 표정 7" 같은 번호)은 화면에 보이지 않는다(요청). 그림과 개수만 보인다. 이름은 화면 읽기용 aria-label에만 있다. */}
                <p className="text-sm font-semibold">{count}개</p>
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
        {/* 위는 "종류"를 고르는 막대, 아래 칸에서만 반응을 고른다. 두 줄이 같은 모양이라 위 칸도 보내는 반응인 줄 알았다는
            요청이 있어, 위는 작은 알약 모양 막대(고른 것만 떠 보이고 나머지는 흐리게)로, 아래는 큰 칸으로 나눴다. */}
        <div role="tablist" aria-label="반응 종류" className="flex gap-1 rounded-full bg-surface-hover p-1">
          {CHARACTERS.map((item) => (
            <PickTab key={item.id} label={item.name} selected={tab === item.id} onSelect={() => setTab(item.id)}>
              <Dori mood={item.id === DEFAULT_CHARACTER ? "like" : "happy"} character={item.id} size={28} />
            </PickTab>
          ))}
          <PickTab label="이모지" selected={tab === EMOJI_TAB} onSelect={() => setTab(EMOJI_TAB)}>
            <span aria-hidden className="text-xl leading-none">
              😊
            </span>
          </PickTab>
        </div>

        {/* 고르는 칸은 캐릭터 표정 두 줄(64px 두 줄 + 간격 8px = 8.5rem)에 딱 맞춘 높이로 두고, 이모지는 그 안에서 스크롤한다.
            이모지가 많아 창이 화면을 다 덮고, 종류를 바꿀 때마다 창 크기가 출렁였다. 높이를 넉넉히 잡았더니 캐릭터 탭 아래가 비어 보였다.
            칸 높이는 폭과 상관없이 정해져 있어 어느 화면 폭에서도 같다. */}
        <div className="border-t border-border pt-4">
          <div
            className={`-mx-1 h-34 overscroll-contain px-1 ${
              tab === EMOJI_TAB ? "overflow-y-auto [mask-image:linear-gradient(to_bottom,black_80%,transparent)]" : ""
            }`}
          >
            {tab === EMOJI_TAB ? (
              <ul role="tabpanel" aria-label="이모지" className="grid animate-fade-in grid-cols-6 gap-1.5 pb-4">
                {REACTIONS.map(({ emoji, label }) => (
                  <li key={emoji}>
                    <PickButton label={label} mine={isMine(emoji)} onPick={() => pick(emoji)} small>
                      <span aria-hidden className="text-2xl leading-none">
                        {emoji}
                      </span>
                    </PickButton>
                  </li>
                ))}
              </ul>
            ) : (
              <ul
                // 종류를 바꾸면 칸이 서서히 바뀐다(탭마다 다른 목록이라 새로 그려지며 한 번 돈다).
                key={tab}
                role="tabpanel"
                aria-label={CHARACTERS.find((item) => item.id === tab)?.name}
                className="grid animate-fade-in grid-cols-5 gap-2"
              >
                {CHARACTER_REACTIONS.filter((reaction) => reaction.character === tab).map(({ value, mood, character, label }) => (
                  <li key={value}>
                    <PickButton label={label} mine={isMine(value)} onPick={() => pick(value)}>
                      <Dori mood={mood} character={character} size={46} />
                    </PickButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** 받은 반응 칩 하나. 개수가 바뀌면 숫자가 한 번 튄다(내가 보내거나 취소한 순간). */
function ReactionChip({
  count,
  fresh,
  onClick,
  className,
  children,
  "aria-label": label,
}: {
  count: number;
  fresh: boolean;
  onClick: () => void;
  className: string;
  children: ReactNode;
  "aria-label": string;
}) {
  const number = useRef<HTMLSpanElement>(null);
  useBump(number, count, 1.4);
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`${className} ${fresh ? "animate-pop" : ""}`}>
      {children}
      <span ref={number} className="inline-block text-xs font-semibold">
        {count}
      </span>
    </button>
  );
}

/** 종류 막대의 탭 하나. 고르는 칸과 헷갈리지 않게 작고 둥글며, 고른 것만 떠 보이고 나머지는 흐리다. */
function PickTab({
  label,
  selected,
  onSelect,
  children,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={label}
      onClick={onSelect}
      className={`flex h-10 flex-1 items-center justify-center rounded-full transition-all ${
        selected ? "bg-surface shadow-sm ring-1 ring-border" : "opacity-50 grayscale-[40%] hover:opacity-80"
      }`}
    >
      {children}
    </button>
  );
}

/** 고르는 창의 칸 하나. 반응의 이름은 화면에 적지 않는다(화면 읽기용 aria-label에만 있다). */
function PickButton({
  label,
  name,
  mine,
  onPick,
  small = false,
  children,
}: {
  label: string;
  name?: string;
  mine: boolean;
  onPick: () => void;
  // 이모지처럼 개수가 많은 칸은 한 줄에 더 넣는다.
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={mine}
      onClick={onPick}
      className={`flex w-full flex-col items-center gap-1 rounded-2xl transition-colors active:scale-95 ${small ? "py-1.5" : "py-2.5"} ${
        mine ? "bg-brand-subtle ring-1 ring-brand/40" : "bg-surface-hover"
      }`}
    >
      <span className={`flex items-center justify-center ${small ? "h-9" : "h-11"}`}>{children}</span>
      {name && <span className={`text-[11px] ${mine ? "text-brand" : "text-muted"}`}>{name}</span>}
    </button>
  );
}
