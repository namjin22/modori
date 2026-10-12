"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// 이만큼 다른 앱에 가 있다 돌아오면 친구의 새 할 일·반응을 받아 온다. 잠깐 알림을 보고 오는 정도는 그대로 둔다.
const AWAY_MS = 60_000;

/**
 * 탭 화면은 한 번 받은 것을 5분 동안 다시 쓴다(next.config.ts staleTimes). 내가 바꾼 것은 서버 액션이 캐시를 비우지만
 * 친구가 바꾼 것은 모른다. 폰에서 앱을 내렸다가 1분 넘게 지나 다시 열면 지금 화면을 새로 받는다.
 */
export function ResumeRefresh() {
  const router = useRouter();

  useEffect(() => {
    let hiddenAt: number | null = null;
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= AWAY_MS) router.refresh();
      hiddenAt = null;
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);

  return null;
}
