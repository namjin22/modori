"use client";

import { type ReactNode, useState, useSyncExternalStore } from "react";

import { useT } from "@/components/locale-provider";
import { Modal } from "@/components/modal";
import { desktop } from "@/lib/i18n/messages/desktop";

/**
 * "Mac에서 앱처럼 쓰기". Windows의 "Windows 앱 받기"처럼 마이페이지에 둔다(2026-10-21 요청).
 * 맥 앱은 따로 만들지 않고(Developer ID 서명이 막혀 있다, docs/macos-app-plan.md) Safari의 "Dock에 추가"로 앱처럼 쓰게 안내한다.
 *
 * 맥 컴퓨터 브라우저에서만 보인다. 아이패드는 사용자 에이전트가 맥처럼 "Macintosh"라고 밝혀서 터치 수로 가린다.
 * 이미 Dock에서 연 창(standalone)과 데스크톱 앱 창에서는 숨긴다. 서버는 이런 것을 알 수 없어 브라우저에서 판단한다.
 */
function subscribe(): () => void {
  return () => {};
}

function isMacBrowser(): boolean {
  const ua = navigator.userAgent;
  if (!/Macintosh/.test(ua) || navigator.maxTouchPoints > 1 || ua.includes("ModoriDesktop")) return false;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !standalone;
}

export function MacAppGuide() {
  const show = useSyncExternalStore(subscribe, isMacBrowser, () => false);
  const t = useT(desktop);
  const [open, setOpen] = useState(false);
  if (!show) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-surface p-6 text-left">
        <span className="flex flex-1 flex-col gap-1">
          <span className="text-[15px] font-semibold">{t("macTitle")}</span>
          <span className="text-[13px] leading-relaxed text-muted">{t("macHint")}</span>
        </span>
        <span className="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-brand-contrast">{t("macShow")}</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t("macModal")}>
        <div className="flex flex-col gap-4 text-sm leading-relaxed">
          <ol className="flex flex-col gap-3">
            <Step n={1}>
              <b>Safari</b>{t("macStep1After")}
            </Step>
            <Step n={2}>
              {t("macStep2Before")}<b>{t("macStep2Bold")}</b>{t("macStep2After")}
            </Step>
            <Step n={3}>
              {t("macStep3Before")}<b>{t("macStep3Bold")}</b>{t("macStep3After")}
            </Step>
          </ol>
          <p className="rounded-xl bg-surface-hover p-3 text-xs text-muted">
            {t("macNote")}
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
          >
            {t("gotIt")}
          </button>
        </div>
      </Modal>
    </>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-bold text-brand">{n}</span>
      <span>{children}</span>
    </li>
  );
}
