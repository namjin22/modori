"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { subscribeNothing } from "@/lib/device-timezone";
import { DESKTOP_DOWNLOAD_URL } from "@/lib/desktop-download";
import { hasPendingUpdate, updateButtonLabel, updateMessage, type UpdateState } from "@/lib/desktop-update";

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
  return (
    <div role="progressbar" aria-label="업데이트 받는 중" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 overflow-hidden rounded-full bg-border">
      <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}

/**
 * 새 버전이 나왔다고 모든 탭 화면 위에 알리는 카드. 누르면 받고, 설치하고, 앱이 다시 시작된다(VS Code·Notion처럼).
 * 받는 것은 누른 뒤에만 한다. 설치 파일이 100MB를 넘어서, 모르는 사이 데이터를 쓰지 않게 하려는 것이다.
 */
export function DesktopUpdateBanner() {
  const state = useUpdateState();
  if (!state || !hasPendingUpdate(state)) return null;
  const downloading = state.status === "downloading";
  const busy = downloading || state.status === "installing";

  return (
    <div role="region" aria-label="앱 업데이트" className="mb-4 flex flex-col gap-3 rounded-2xl bg-brand-subtle p-4">
      <p className="text-sm">
        새 버전 <b className="font-semibold">{state.version}</b>이 나왔어요. 누르면 받아서 설치하고 앱이 다시 시작돼요.
      </p>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-muted">
          {updateMessage(state)}
        </p>
      )}
      {downloading && <ProgressBar percent={state.percent} />}
      <button
        type="button"
        disabled={busy}
        onClick={startUpdate}
        className="h-10 rounded-xl bg-brand text-sm font-semibold text-brand-contrast disabled:opacity-60"
      >
        {updateButtonLabel(state)}
      </button>
    </div>
  );
}

/**
 * 마이페이지의 "앱 업데이트". 지금 버전을 보이고, 새 버전을 직접 확인하거나 받을 수 있다.
 * 앱 안 업데이트가 없던 옛 앱(1.0.6 이하)은 연결이 없어서, 한 번만 새로 설치하라고 안내한다. 그다음부터는 앱 안에서 된다.
 */
export function DesktopUpdateRow() {
  const bridge = useSyncExternalStore(subscribeNothing, () => Boolean(window.modoriUpdater), () => null);
  const state = useUpdateState();
  const windows = useSyncExternalStore(subscribeNothing, () => navigator.userAgent.includes("Windows"), () => false);

  if (bridge === null) return null;
  if (!bridge) return windows ? <LegacyApp /> : null;
  if (!state || !state.supported) return null;

  const pending = hasPendingUpdate(state);
  const busy = state.status === "checking" || state.status === "downloading" || state.status === "installing";

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-surface p-6">
      <h2 className="text-sm font-semibold text-muted">앱 업데이트</h2>
      <div className="flex items-center gap-3">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-medium">모도리 {state.current}</span>
          {/* 받는 중에는 퍼센트가 1%마다 바뀌어 스크린리더가 계속 읽게 된다. 진행은 위의 진행 막대가 알린다. */}
          <span aria-live={state.status === "downloading" ? "off" : "polite"} className="text-[13px] text-muted">
            {updateMessage(state)}
          </span>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={pending ? startUpdate : () => window.modoriUpdater?.check()}
          className="h-10 shrink-0 rounded-full bg-brand px-4 text-sm font-semibold text-brand-contrast disabled:opacity-60"
        >
          {updateButtonLabel(state)}
        </button>
      </div>
      {state.status === "downloading" && <ProgressBar percent={state.percent} />}
    </section>
  );
}

function LegacyApp() {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-6">
      <h2 className="text-sm font-semibold text-muted">앱 업데이트</h2>
      <p className="text-[13px] leading-relaxed text-muted">
        이 앱은 앱 안에서 업데이트하는 기능이 없는 옛 버전이에요. 한 번만 새로 설치하면 그다음부터는 여기서 누르는 것만으로 업데이트돼요.
        로그인과 설정은 그대로예요.
      </p>
      <a href={DESKTOP_DOWNLOAD_URL} className="flex h-11 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-contrast">
        새 버전 받기
      </a>
    </section>
  );
}
