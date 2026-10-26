"use client";

import { type ReactNode, useState, useSyncExternalStore } from "react";

import { Modal } from "@/components/modal";

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
  const [open, setOpen] = useState(false);
  if (!show) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-surface p-6 text-left">
        <span className="flex flex-1 flex-col gap-1">
          <span className="text-[15px] font-semibold">Mac에서 앱처럼 쓰기</span>
          <span className="text-[13px] leading-relaxed text-muted">Dock에 추가하면 브라우저 없이 바로 열려요</span>
        </span>
        <span className="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-brand-contrast">방법 보기</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Dock에 추가하는 방법">
        <div className="flex flex-col gap-4 text-sm leading-relaxed">
          <ol className="flex flex-col gap-3">
            <Step n={1}>
              <b>Safari</b>에서 modori.site를 열고 로그인해요. (Chrome 등 다른 브라우저라면 Safari로 열어 주세요)
            </Step>
            <Step n={2}>
              화면 맨 위 메뉴 막대에서 <b>파일 → Dock에 추가</b>를 눌러요.
            </Step>
            <Step n={3}>
              이름이 &ldquo;모도리&rdquo;로 뜨면 <b>추가</b>를 눌러요. Dock과 응용 프로그램 폴더에 모도리가 생겨요.
            </Step>
          </ol>
          <p className="rounded-xl bg-surface-hover p-3 text-xs text-muted">
            Dock에서 연 모도리는 주소창 없이 앱처럼 열려요. 알림을 받으려면 마이페이지의 알림에서 &ldquo;이 기기에서 알림
            띄우기&rdquo;를 켜 주세요.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
          >
            알겠어요
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
