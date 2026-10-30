"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { useLocale, useT } from "@/components/locale-provider";
import { subscribeNothing } from "@/lib/device-timezone";
import { DESKTOP_DOWNLOAD_URL } from "@/lib/desktop-download";
import { hasPendingUpdate, updateButtonLabel, updateMessage, type UpdateState } from "@/lib/desktop-update";
import { desktop } from "@/lib/i18n/messages/desktop";

/** 앱(desktop/updater.js)의 업데이트 상태를 따라간다. 웹 브라우저나 옛 앱처럼 연결이 없으면 null. */
function useUpdateState(): UpdateState | null {
  const [state, setState] = useState<UpdateState | null>(null);
  useEffect(() => {
    const updater = window.modoriUpdater;
    if (!updater) return;
    let alive = true;
    updater
      .getState()
      .then((current) => {
        if (alive && current) setState(current);
      })
      .catch((error) => console.warn("[update] 업데이트 상태를 읽지 못했다.", error instanceof Error ? error.name : error));
    const stopListening = updater.onState(setState);
    return () => {
      alive = false;
      stopListening();
    };
  }, []);
  return state;
}

function startUpdate() {
  window.modoriUpdater?.start();
}

function ProgressBar({ percent }: { percent: number }) {
  const t = useT(desktop);
  return (
    <div role="progressbar" aria-label={t("downloading")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 overflow-hidden rounded-full bg-border">
      <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}

/**
 * 새 버전이 나왔다고 모든 탭 화면 위에 알리는 카드. 누르면 받고, 설치하고, 앱이 다시 시작된다(VS Code·Notion처럼).
 * 받는 것은 누른 뒤에만 한다. 설치 파일이 100MB를 넘어서, 모르는 사이 데이터를 쓰지 않게 하려는 것이다.
 */
export function DesktopUpdateBanner() {
  const t = useT(desktop);
  const locale = useLocale();
  const state = useUpdateState();
  if (!state || !hasPendingUpdate(state)) return null;
  const downloading = state.status === "downloading";
  const busy = downloading || state.status === "installing";

  return (
    <div role="region" aria-label={t("updateRegion")} className="mb-4 flex flex-col gap-3 rounded-2xl bg-brand-subtle p-4">
      <p className="text-sm">
        {t("newVersionBefore")}<b className="font-semibold">{state.version}</b>{t("newVersionAfter")}
      </p>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-muted">
          {updateMessage(state, locale)}
        </p>
      )}
      {downloading && <ProgressBar percent={state.percent} />}
      <button
        type="button"
        disabled={busy}
        onClick={startUpdate}
        className="h-10 rounded-xl bg-brand text-sm font-semibold text-brand-contrast disabled:opacity-60"
      >
        {updateButtonLabel(state, locale)}
      </button>
    </div>
  );
}

/**
 * 마이페이지의 "앱 업데이트". 지금 버전을 보이고, 새 버전을 직접 확인하거나 받을 수 있다.
 * 앱 안 업데이트가 없는 옛 앱(1.0.6 이하)은 이 줄 대신 OutdatedAppNotice를 쓴다(app/(tabs)/settings/page.tsx).
 */
export function DesktopUpdateRow() {
  const t = useT(desktop);
  const locale = useLocale();
  const bridge = useSyncExternalStore(subscribeNothing, () => Boolean(window.modoriUpdater), () => false);
  const state = useUpdateState();

  if (!bridge || !state || !state.supported) return null;

  const pending = hasPendingUpdate(state);
  const busy = state.status === "checking" || state.status === "downloading" || state.status === "installing";

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-surface p-6">
      <h2 className="text-sm font-semibold text-muted">{t("updateTitle")}</h2>
      <div className="flex items-center gap-3">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-medium">{t("appName", { version: state.current })}</span>
          {/* 받는 중에는 퍼센트가 1%마다 바뀌어 스크린리더가 계속 읽게 된다. 진행은 위의 진행 막대가 알린다. */}
          <span aria-live={state.status === "downloading" ? "off" : "polite"} className="text-[13px] text-muted">
            {updateMessage(state, locale)}
          </span>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={pending ? startUpdate : () => window.modoriUpdater?.check()}
          className="h-10 shrink-0 rounded-full bg-brand px-4 text-sm font-semibold text-brand-contrast disabled:opacity-60"
        >
          {updateButtonLabel(state, locale)}
        </button>
      </div>
      {state.status === "downloading" && <ProgressBar percent={state.percent} />}
    </section>
  );
}

/**
 * 앱 안 업데이트가 없는 옛 앱의 마이페이지 줄. 한 번만 새로 설치하면 그다음부터는 앱 안에서 업데이트된다.
 * 설치 파일 링크는 앱이 평소 브라우저로 열어 준다(desktop/main.js의 guardNavigation, 1.0.0부터).
 */
export function OutdatedAppNotice({ version }: { version: string }) {
  const t = useT(desktop);
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-6">
      <h2 className="text-sm font-semibold text-muted">{t("updateTitle")}</h2>
      <p className="text-[13px] leading-relaxed text-muted">{t("outdatedRowBefore", { version })}</p>
      <a href={DESKTOP_DOWNLOAD_URL} className="flex h-11 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-contrast">
        {t("getLatest")}
      </a>
    </section>
  );
}

/**
 * 옛 앱이 탭 화면 위에서 최신 버전으로 업데이트해 달라고 알리는 카드(2026-10-28 요청). 서버가 사용자 에이전트의 앱 버전을 읽어
 * 옛 앱일 때만 그린다(app/(tabs)/layout.tsx). "나중에"는 이 앱을 다시 켤 때까지만 숨긴다: 저장하지 않으므로 기기에 남는 것이 없다.
 * 앱 안 업데이트가 있는 앱(1.0.7부터)은 새 버전이 나왔을 때 DesktopUpdateBanner가 알린다.
 */
export function OutdatedAppBanner({ version }: { version: string }) {
  const t = useT(desktop);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div role="region" aria-label={t("updateRegion")} className="mb-4 flex flex-col gap-3 rounded-2xl bg-brand-subtle p-4">
      <p className="text-sm">
        {t("outdatedBannerBefore")}<b className="font-semibold">{version}</b>{t("outdatedBannerAfter")}
      </p>
      <p className="text-xs leading-relaxed text-muted">
        {t("outdatedHintBefore")}<b>{t("moreInfo")}</b>{t("outdatedHintMid")}<b>{t("run")}</b>{t("outdatedHintAfter")}
      </p>
      <div className="flex gap-2">
        <a
          href={DESKTOP_DOWNLOAD_URL}
          className="flex h-10 flex-1 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
        >
          {t("getLatest")}
        </a>
        <button type="button" onClick={() => setHidden(true)} className="h-10 flex-1 rounded-xl bg-surface text-sm font-medium text-muted">
          {t("later")}
        </button>
      </div>
    </div>
  );
}
