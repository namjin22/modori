"use client";

import { useEffect, useState } from "react";

import { STALE_EVENT, STALE_MESSAGE } from "@/components/use-save-failure";

/**
 * 화면을 오래 열어 두는 사이 앱이 새 버전이 되었거나 서버가 응답하지 못해 저장이 실패하면 뜨는 안내.
 * 알림(토스트)은 몇 초 뒤 사라지지만 이 배너는 새로고침할 때까지 남는다. 모바일 앱에는 새로고침 버튼이나 당겨서 새로고침이
 * 없어서, 이 버튼이 없으면 사용자가 스스로 빠져나올 방법이 없다.
 */
export function StaleBanner() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const show = () => setStale(true);
    window.addEventListener(STALE_EVENT, show);
    return () => window.removeEventListener(STALE_EVENT, show);
  }, []);

  if (!stale) return null;
  return (
    <div
      role="alert"
      aria-label="새로고침 안내"
      className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-[60] flex justify-center px-5"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-foreground py-3 pl-4 pr-2 text-sm text-background shadow-lg">
        <span className="flex-1">{STALE_MESSAGE}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-9 shrink-0 rounded-xl bg-background px-4 font-semibold text-foreground"
        >
          새로고침
        </button>
      </div>
    </div>
  );
}
