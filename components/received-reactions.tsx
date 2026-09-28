"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
import { ReactionGlyph } from "@/components/reaction-glyph";
import { labelOfReaction, type ReceivedReaction } from "@/lib/reactions";

/**
 * 내 할 일에 친구들이 보낸 반응(투두메이트처럼 할 일 밑에). 칩을 누르면 누가 보냈는지 창으로 보여준다.
 * 내 일에는 내가 반응할 수 없어서 누르면 반응이 바뀌는 게 아니라 보낸 사람을 보여준다.
 * 누른 반응을 맨 위에 두고, 이 할 일에 온 다른 반응도 아래에 같이 둔다.
 */
export function ReceivedReactions({ received }: { received: ReceivedReaction[] }) {
  const [opened, setOpened] = useState<string | null>(null);
  if (received.length === 0) return null;

  const ordered = opened
    ? [...received].sort((a, b) => Number(b.emoji === opened) - Number(a.emoji === opened))
    : received;

  return (
    <>
      {/* 글자와 줄을 맞추려고 체크 칸만큼 들인다. */}
      <ul aria-label="받은 반응" className="mt-1.5 flex flex-wrap gap-1 pl-[34px]">
        {received.map(({ emoji, count }) => (
          <li key={emoji}>
            <button
              type="button"
              onClick={() => setOpened(emoji)}
              aria-label={`${labelOfReaction(emoji)} ${count}개, 누가 보냈는지 보기`}
              className="flex h-7 items-center gap-1 rounded-full bg-surface-hover px-2 text-xs text-muted transition-colors hover:text-foreground active:scale-95"
            >
              <ReactionGlyph value={emoji} size={20} />
              <span aria-hidden className="font-semibold">
                {count}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Modal open={opened !== null} onClose={() => setOpened(null)} title="받은 반응">
        <ul className="flex flex-col gap-3">
          {ordered.map(({ emoji, count, names }) => (
            <li key={emoji} className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-hover">
                <ReactionGlyph value={emoji} size={28} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-semibold">
                  {labelOfReaction(emoji)} <span className="font-normal text-muted">{count}개</span>
                </p>
                <p className="text-sm text-muted">{names.length > 0 ? names.join(", ") : "지운 계정"}</p>
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
