"use client";

import { useState } from "react";

import { logout } from "@/app/(tabs)/settings/actions";
import { Dori } from "@/components/dori";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";

/**
 * 로그아웃은 한 번 더 묻는다. 마이페이지에서 스크롤하다 잘못 누르면 다시 로그인해야 하는데,
 * 학교 계정(DataGSM) 로그인은 몇 단계를 거쳐서 번거롭다.
 */
export function LogoutButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-12 w-full rounded-2xl bg-surface text-sm text-muted transition-colors hover:text-foreground"
      >
        로그아웃
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="로그아웃할까요?">
        <div className="flex flex-col items-center gap-2 text-center">
          <Dori mood="hello" size={88} />
          <p className="text-balance text-sm text-muted">다음에 또 만나요. 기록은 그대로 남아 있어요.</p>
        </div>
        <form action={logout} className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-12 rounded-2xl bg-surface-hover text-sm font-semibold"
          >
            취소
          </button>
          <SubmitButton
            pendingLabel="나가는 중"
            className="h-12 rounded-2xl bg-brand text-sm font-semibold text-brand-contrast"
          >
            로그아웃
          </SubmitButton>
        </form>
      </Modal>
    </>
  );
}
