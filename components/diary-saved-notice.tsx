"use client";

import { useEffect } from "react";

/**
 * 일기를 저장하고 넘어온 읽는 화면의 "저장했어요."(2026-11-24). 쓰기 화면이 주소에 ?saved=1을 붙여 보낸다.
 * 보이자마자 주소에서 그 표시를 지운다. 새로 고침하거나 나중에 다시 와도 "저장했어요."가 또 뜨지 않게.
 */
export function DiarySavedNotice({ text }: { text: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("saved");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  return (
    <p role="status" className="text-sm text-muted">
      {text}
    </p>
  );
}
