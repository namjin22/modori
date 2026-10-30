"use client";

import { useEffect, useSyncExternalStore } from "react";

import { DEFAULT_LOCALE, translator } from "@/lib/i18n";
import { subscribeNothing } from "@/lib/device-timezone";
import { cookieLocale } from "@/lib/i18n/client";
import { errors } from "@/lib/i18n/messages/errors";
import { reloadOnce } from "@/lib/reload-guard";

import "./globals.css";

/**
 * 맨 바깥 레이아웃에서 난 오류. 없으면 Next.js 기본 화면(영어 "This page couldn't load", Reload/Back)이 뜬다.
 * 아이폰 앱에서 화면을 옮기는 요청이 끊기면 이 화면이 떴고, 앱에는 새로고침 버튼이 없어 "Reload"를 눌러야만 넘어갔다.
 * 먼저 저절로 한 번 새로고침하고, 그래도 안 되면 우리말 안내와 버튼을 보인다.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  // 맨 바깥 레이아웃이 깨졌으니 언어를 건네줄 곳이 없다. 처음은 한국어로 그리고, 브라우저에서 쿠키를 읽어 바꾼다.
  const locale = useSyncExternalStore(subscribeNothing, cookieLocale, () => DEFAULT_LOCALE);
  const t = translator(errors, locale);

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
    <html lang={locale}>
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
        <div>
          <h1 className="text-xl font-bold">{t("globalTitle")}</h1>
          <p className="mt-2 text-sm text-muted">{t("globalBody")}</p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-12 rounded-2xl bg-brand text-sm font-semibold text-brand-contrast"
          >
            {t("reloadAgain")}
          </button>
          <button
            type="button"
            // 라우터가 깨진 상태일 수 있어 화면을 통째로 새로 연다.
            onClick={() => window.location.assign(window.location.origin)}
            className="h-12 rounded-2xl bg-surface text-sm font-medium"
          >
            {t("toStart")}
          </button>
        </div>
      </body>
    </html>
  );
}
