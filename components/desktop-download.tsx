"use client";

import { useState } from "react";

import { useT } from "@/components/locale-provider";
import { Modal } from "@/components/modal";
import { DESKTOP_DOWNLOAD_URL } from "@/lib/desktop-download";
import { desktop } from "@/lib/i18n/messages/desktop";

/**
 * "Windows 앱 받기". 누르면 다운로드가 시작되고 설치 안내 창이 같이 뜬다.
 *
 * 설치 파일에 코드 서명이 없어 처음 실행하면 Windows가 "Windows의 PC 보호"(게시자 알 수 없음)를 띄운다.
 * 인증서는 비용이 들어 아직 없다. 여기서 누를 곳을 모르면 설치를 포기하므로 그 순서를 미리 보여준다.
 * 링크는 그대로 두어 다운로드는 브라우저가 한다(창은 안내만 한다).
 */
export function DesktopDownload() {
  const t = useT(desktop);
  const [open, setOpen] = useState(false);

  return (
    <>
      <a
        href={DESKTOP_DOWNLOAD_URL}
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-2xl bg-surface p-6"
      >
        <span className="flex flex-1 flex-col gap-1">
          <span className="text-[15px] font-semibold">{t("getWindows")}</span>
          <span className="text-[13px] leading-relaxed text-muted">{t("getWindowsHint")}</span>
        </span>
        <span className="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-brand-contrast">
          {t("download")}
        </span>
      </a>

      <Modal open={open} onClose={() => setOpen(false)} title={t("installTitle")}>
        <div className="flex flex-col gap-4 text-sm leading-relaxed">
          <p className="text-muted">{t("installStarted")}</p>
          <ol className="flex flex-col gap-3">
            <Step n={1}>
              {t("step1Before")}<b>Modori-Setup.exe</b>{t("step1After")}
            </Step>
            <Step n={2}>
              <b>{t("step2Quote")}</b>{t("step2Mid1")}<b>{t("moreInfo")}</b>{t("step2Mid2")}<b>{t("run")}</b>{t("step2After")}
              <span className="mt-1 block text-xs text-muted">
                {t("step2Note")}
              </span>
            </Step>
            <Step n={3}>{t("step3")}</Step>
          </ol>
          <div className="rounded-xl bg-surface-hover p-3 text-xs text-muted">
            <p className="font-semibold text-foreground">{t("alreadyInstalled")}</p>
            <p className="mt-1">
              {t("alreadyBefore")}<b>{t("ok")}</b>{t("alreadyAfter")}
            </p>
          </div>
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

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-contrast">
        {n}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}
