"use client";

import { useEffect } from "react";

import { useT } from "@/components/locale-provider";
import { desktop } from "@/lib/i18n/messages/desktop";

/**
 * 브라우저에서 모도리 앱을 연다. 브라우저가 "모도리 열기"를 한 번 물어볼 수 있다.
 * 자동으로 한 번 열고, 막혔거나 취소했으면 버튼으로 다시 연다.
 */
export function DesktopHandoff({ href }: { href: string }) {
  const t = useT(desktop);
  useEffect(() => {
    window.location.href = href;
  }, [href]);

  return (
    <>
      <a
        href={href}
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-brand-contrast"
      >
        {t("openApp")}
      </a>
      <p>{t("openAppHint")}</p>
    </>
  );
}
