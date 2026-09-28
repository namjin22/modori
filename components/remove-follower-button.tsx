"use client";

import { useState } from "react";

import { removeFollower } from "@/app/(tabs)/feed/actions";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";

/**
 * 팔로워 끊기. 되돌리기 알림 대신 한 번 묻는다. 되돌리기는 "이 사람이 나를 팔로우한다"를 다시
 * 만드는 요청이라, 값을 바꿔 보내면 아무나 나를 팔로우하게 만들 수 있다.
 */
export function RemoveFollowerButton({ id, nickname }: { id: string; nickname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${nickname} 팔로워 끊기`}
        className="h-9 shrink-0 rounded-full px-3 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
      >
        끊기
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="팔로워를 끊을까요?">
        <p className="text-balance text-sm text-muted">
          <span className="font-semibold text-foreground">{nickname}</span>님은 더 이상 내 할 일을 보거나
          반응을 보낼 수 없어요. 나중에 다시 팔로우할 수는 있어요.
        </p>
        <form action={removeFollower} className="grid grid-cols-2 gap-2">
          <input type="hidden" name="followerId" value={id} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-12 rounded-2xl bg-surface-hover text-sm font-semibold"
          >
            취소
          </button>
          <SubmitButton
            pendingLabel="끊는 중"
            className="h-12 rounded-2xl bg-danger text-sm font-semibold text-background"
          >
            끊기
          </SubmitButton>
        </form>
      </Modal>
    </>
  );
}
