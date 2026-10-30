"use client";

import { useState } from "react";

import { removeFollower } from "@/app/(tabs)/feed/actions";
import { useT } from "@/components/locale-provider";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { common } from "@/lib/i18n/messages/common";
import { social } from "@/lib/i18n/messages/social";

/**
 * 팔로워 끊기. 되돌리기 알림 대신 한 번 묻는다. 되돌리기는 "이 사람이 나를 팔로우한다"를 다시
 * 만드는 요청이라, 값을 바꿔 보내면 아무나 나를 팔로우하게 만들 수 있다.
 */
export function RemoveFollowerButton({ id, nickname }: { id: string; nickname: string }) {
  const t = useT(social);
  const tc = useT(common);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("removeFollowerLabel", { nickname })}
        className="h-9 shrink-0 rounded-full px-3 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
      >
        {t("removeShort")}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t("removeTitle")}>
        <p className="text-balance text-sm text-muted">
          <span className="font-semibold text-foreground">{nickname}</span>
          {t("removeBodyAfter")}
        </p>
        <form action={removeFollower} className="grid grid-cols-2 gap-2">
          <input type="hidden" name="followerId" value={id} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-12 rounded-2xl bg-surface-hover text-sm font-semibold"
          >
            {tc("cancel")}
          </button>
          <SubmitButton
            pendingLabel={t("removing")}
            className="h-12 rounded-2xl bg-danger text-sm font-semibold text-background"
          >
            {t("removeShort")}
          </SubmitButton>
        </form>
      </Modal>
    </>
  );
}
