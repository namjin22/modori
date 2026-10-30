"use client";

import { useState } from "react";

import { useLocale, useT } from "@/components/locale-provider";
import { Modal } from "@/components/modal";
import { ReactionGlyph } from "@/components/reaction-glyph";
import { reactions } from "@/lib/i18n/messages/reactions";
import { labelOfReaction, type ReceivedReaction } from "@/lib/reactions";

// 줄 오른쪽에 겹쳐 보이는 그림 수. 이보다 종류가 많아도 줄 폭이 늘지 않는다(전체는 창에서 본다).
const MAX_SHOWN = 2;

/**
 * 내 할 일에 친구들이 보낸 반응. 할 일 줄 오른쪽 끝에 작은 그림 몇 개를 겹쳐 놓고 받은 개수 합을 붙인다.
 * 할 일 밑에 칩으로 늘어놓았을 때(2026-10 이전)는 반응이 많을수록 줄이 길어져 목록이 어수선했다.
 * 누르면 종류별 개수와 보낸 사람을 창으로 보여준다. 내 일에는 내가 반응할 수 없어서 누르면 반응이 바뀌는 게 아니라 보낸 사람을 보여준다.
 */
export function ReceivedReactions({ received }: { received: ReceivedReaction[] }) {
  const t = useT(reactions);
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  if (received.length === 0) return null;

  const total = received.reduce((sum, { count }) => sum + count, 0);
  const summary = received.map(({ emoji, count }) => t("receivedSummary", { label: labelOfReaction(emoji, locale), count })).join(", ");

  return (
    <>
      <ul aria-label={t("receivedTitle")} className="shrink-0">
        <li>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("receivedOpen", { summary })}
            className="-my-0.5 flex h-7 items-center gap-1.5 rounded-full pr-1 text-xs text-muted transition-colors hover:text-foreground active:scale-95"
          >
            <span aria-hidden className="flex">
              {received.slice(0, MAX_SHOWN).map(({ emoji }, index) => (
                // 겹친 가장자리가 깔끔히 보이게 바탕색 테두리를 두른다.
                <span
                  key={emoji}
                  className={`flex size-6 items-center justify-center rounded-full bg-surface-hover ring-2 ring-background ${index > 0 ? "-ml-1.5" : ""}`}
                >
                  <ReactionGlyph value={emoji} size={20} />
                </span>
              ))}
            </span>
            <span aria-hidden className="font-semibold tabular-nums">
              {total}
            </span>
          </button>
        </li>
      </ul>

      <Modal open={open} onClose={() => setOpen(false)} title={t("receivedTitle")}>
        <ul className="flex flex-col gap-3">
          {received.map(({ emoji, count, names }) => (
            <li key={emoji} className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-hover">
                <ReactionGlyph value={emoji} size={28} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                {/* 반응의 이름("펭이 표정 7" 같은 번호)은 화면에 보이지 않는다(요청). 그림과 개수만 보인다. 이름은 화면 읽기용 aria-label에만 있다. */}
                <p className="text-sm font-semibold">{t("countOnly", { count })}</p>
                <p className="text-sm text-muted">{names.length > 0 ? names.join(", ") : t("deletedAccount")}</p>
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
