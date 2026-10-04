"use client";

import { useEffect } from "react";

import { SOURCE_KEY, sourceFromSearch, sourceFromUserAgent } from "@/lib/signup-source";

/**
 * 링크의 `?from=` 값(없으면 앱 안에서 연 화면인지)을 처음 한 번 브라우저에 적어 둔다. 가입할 때 온보딩이 읽어
 * 서버로 보낸다. 쿠키가 아니라 이 기기의 localStorage에만 두고, 이미 있으면 덮어쓰지 않는다(처음 닿은 경로를 센다).
 */
export function SourceCapture({ fallback }: { fallback?: string }) {
  useEffect(() => {
    try {
      if (localStorage.getItem(SOURCE_KEY)) return;
      const found =
        sourceFromSearch(window.location.search) ??
        sourceFromUserAgent(navigator.userAgent) ??
        fallback ??
        null;
      if (found) localStorage.setItem(SOURCE_KEY, found);
    } catch (error) {
      // 저장소가 막힌 브라우저(사생활 보호 창 등)에서는 경로를 모르는 채로 가입한다. 화면에는 영향이 없다.
      console.warn("[source] 가입 경로를 적어 두지 못했다.", error instanceof Error ? error.name : error);
    }
  }, [fallback]);

  return null;
}
