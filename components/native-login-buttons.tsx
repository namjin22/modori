"use client";

import { useState } from "react";

import { AppleLogo } from "@/components/apple-logo";
import { appSource, capacitor, createVerifier, VERIFIER_KEY } from "@/lib/native-login";

/**
 * 모바일 앱의 로그인 버튼. Google은 앱 안에 끼운 화면에서의 로그인을 막아, 평소 쓰는 브라우저 창(시스템 로그인 창)을
 * 열어 거기서 로그인하고 modori://로 돌아온다(components/native-bridge.tsx가 받는다).
 */
export function NativeLoginButtons({ providers }: { providers: { id: "google" | "datagsm" | "apple"; label: string; primary: boolean }[] }) {
  const [problem, setProblem] = useState<string | null>(null);

  async function start(provider: string) {
    setProblem(null);
    const bridge = capacitor();
    const browser = bridge?.Plugins?.Browser;
    if (!bridge || !browser) {
      setProblem("앱에서 로그인 창을 열지 못했어요. 앱을 다시 켜 주세요.");
      return;
    }
    try {
      const { verifier, challenge } = await createVerifier();
      localStorage.setItem(VERIFIER_KEY, verifier);
      const login = new URL("/desktop/login", window.location.origin);
      login.searchParams.set("challenge", challenge);
      login.searchParams.set("provider", provider);
      // 가입은 시스템 브라우저에서 이뤄지니, 앱에서 왔다는 표시를 링크에 실어 보낸다(lib/signup-source.ts).
      login.searchParams.set("from", appSource(bridge));
      await browser.open({ url: login.toString() });
    } catch (error) {
      console.error("[native-login] 로그인 창을 열지 못했다.", error);
      setProblem("로그인 창을 열지 못했어요. 다시 눌러 주세요.");
    }
  }

  return (
    <>
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => void start(provider.id)}
          className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold transition-colors active:scale-[0.98] ${
            provider.primary
              ? "bg-brand text-brand-contrast hover:bg-brand-hover"
              : provider.id === "apple"
                ? // Apple의 버튼 지침: 검정 바탕(어두운 화면에서는 흰 바탕)에 사과 표시.
                  "bg-foreground text-background"
                : "bg-surface text-foreground hover:bg-surface-hover"
          }`}
        >
          {provider.id === "apple" && <AppleLogo />}
          {provider.label}
        </button>
      ))}
      {problem && (
        <p role="alert" className="text-center text-sm text-danger">
          {problem}
        </p>
      )}
      <p className="text-center text-xs text-muted">누르면 로그인 창이 열려요. 로그인을 마치면 앱으로 돌아와요.</p>
    </>
  );
}
