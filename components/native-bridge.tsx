"use client";

import { useEffect } from "react";

import { capacitor, codeFromLink, VERIFIER_KEY } from "@/lib/native-login";

/**
 * 모바일 앱 안에서만 하는 일: 브라우저에서 로그인을 마치고 앱이 modori://login?code=… 로 열리면, 코드와 앞서 만든
 * verifier를 서버에 보내 세션을 받는다(/api/desktop/exchange, 데스크톱 앱과 같다). 일반 브라우저에서는 아무 일도 하지 않는다.
 * 모든 화면에 붙여 두어 앱이 꺼져 있다가 링크로 켜져도 어느 화면에서든 받는다.
 */
export function NativeBridge() {
  useEffect(() => {
    const bridge = capacitor();
    const app = bridge?.Plugins?.App;
    if (!bridge || !app) return;

    function handle(url: string) {
      const code = codeFromLink(url);
      if (!code) return;
      // iOS는 로그인 창(SFSafariViewController)이 앱 위에 떠 있는 채로 링크가 온다. Android의 Custom Tabs는 앱으로 돌아오며 저절로 닫힌다.
      if (bridge?.getPlatform?.() === "ios") {
        bridge.Plugins?.Browser?.close?.().catch((error: unknown) => console.warn("[native-login] 로그인 창을 닫지 못했다.", error));
      }
      const verifier = localStorage.getItem(VERIFIER_KEY);
      // 코드는 한 번만 쓰고, 처음 만든 verifier가 없으면(다른 기기에서 온 링크) 쓰지 않는다.
      localStorage.removeItem(VERIFIER_KEY);
      if (!verifier) return;
      const exchange = new URL("/api/desktop/exchange", window.location.origin);
      exchange.searchParams.set("code", code);
      exchange.searchParams.set("verifier", verifier);
      window.location.href = exchange.toString();
    }

    const listening = app.addListener("appUrlOpen", (data) => handle(data.url));
    // 앱이 링크 때문에 처음 켜졌다면 리스너보다 링크가 먼저 도착한다.
    app.getLaunchUrl().then(
      (launch) => {
        if (launch?.url) handle(launch.url);
      },
      (error: unknown) => console.warn("[native-login] 처음 열린 주소를 읽지 못했다.", error),
    );
    return () => {
      void listening.then((handle) => (handle as { remove?: () => void } | undefined)?.remove?.());
    };
  }, []);

  return null;
}
