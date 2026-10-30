"use client";

import { useRef, useState } from "react";

import { Dori } from "@/components/dori";
import { useT } from "@/components/locale-provider";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { auth } from "@/lib/i18n/messages/auth";
import { common } from "@/lib/i18n/messages/common";
import { unregisterPushToken } from "@/lib/push-client";
import { unsubscribeWebPush } from "@/lib/web-push-client";

/**
 * 로그아웃은 한 번 더 묻는다. 마이페이지에서 스크롤하다 잘못 누르면 다시 로그인해야 하는데,
 * 학교 계정(DataGSM) 로그인은 몇 단계를 거쳐서 번거롭다.
 */
export function LogoutButton() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const t = useT(auth);
  const tc = useT(common);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-12 w-full rounded-2xl bg-surface text-sm text-muted transition-colors hover:text-foreground"
      >
        {t("logout")}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t("logoutTitle")}>
        <div className="flex flex-col items-center gap-2 text-center">
          <Dori mood="hello" size={88} />
          <p className="text-balance text-sm text-muted">{t("logoutBody")}</p>
        </div>
        {/* 일반 폼 POST로 로그아웃하고 로그인 화면을 통째로 새로 연다(app/api/logout/route.ts). */}
        <form
          ref={formRef}
          method="post"
          action="/api/logout"
          onSubmit={(event) => {
            if (leaving) return;
            event.preventDefault();
            setLeaving(true);
            // 이 기기가 로그아웃한 계정의 알림을 계속 받지 않게 번호·웹 푸시 구독을 먼저 지운다. 세션이 살아 있을 때 해야 한다.
            void Promise.allSettled([unregisterPushToken(), unsubscribeWebPush()])
              .then((results) => {
                for (const result of results) {
                  if (result.status === "rejected") console.warn("[logout] 알림 구독을 지우지 못했다.", result.reason);
                }
              })
              .finally(() => formRef.current?.submit());
          }}
          className="grid grid-cols-2 gap-2"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-12 rounded-2xl bg-surface-hover text-sm font-semibold"
          >
            {tc("cancel")}
          </button>
          <SubmitButton
            pending={leaving}
            pendingLabel={t("leaving")}
            className="h-12 rounded-2xl bg-brand text-sm font-semibold text-brand-contrast"
          >
            {t("logout")}
          </SubmitButton>
        </form>
      </Modal>
    </>
  );
}
