"use client";

import { useEffect } from "react";

import { reloadOnce } from "@/lib/reload-guard";

import "./globals.css";

/**
 * 맨 바깥 레이아웃에서 난 오류. 없으면 Next.js 기본 화면(영어 "This page couldn't load", Reload/Back)이 뜬다.
 * 아이폰 앱에서 화면을 옮기는 요청이 끊기면 이 화면이 떴고, 앱에는 새로고침 버튼이 없어 "Reload"를 눌러야만 넘어갔다.
 * 먼저 저절로 한 번 새로고침하고, 그래도 안 되면 우리말 안내와 버튼을 보인다.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("[global-error]", error);
    if (!error.digest) {
      navigator.sendBeacon(
        "/api/errors",
        JSON.stringify({ message: `global: ${error.name}: ${error.message}`, path: location.pathname }),
      );
    }
    reloadOnce();
  }, [error]);

  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
        <div>
          <h1 className="text-xl font-bold">화면을 불러오지 못했어요</h1>
          <p className="mt-2 text-sm text-muted">인터넷 연결을 확인하고 다시 불러와 주세요.</p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-12 rounded-2xl bg-brand text-sm font-semibold text-brand-contrast"
          >
            다시 불러오기
          </button>
          <button
            type="button"
            // 라우터가 깨진 상태일 수 있어 화면을 통째로 새로 연다.
            onClick={() => window.location.assign(window.location.origin)}
            className="h-12 rounded-2xl bg-surface text-sm font-medium"
          >
            처음 화면으로
          </button>
        </div>
      </body>
    </html>
  );
}
