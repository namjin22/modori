"use client";

import { useEffect } from "react";

import { Dori } from "@/components/dori";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 화면에는 사람이 읽을 말만 보여주고, 원인은 로그에 남긴다.
    console.error("[error]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <Dori mood="sad" size={110} className="mx-auto" />
        <h1 className="mt-3 text-xl font-bold">잠깐 문제가 생겼어요</h1>
        <p className="mt-2 text-sm text-muted">
          잠깐 뒤에 다시 해보세요. 계속 이러면 알려주세요.
        </p>
      </div>

      <button
        type="button"
        onClick={reset}
        className="h-12 w-full rounded-2xl bg-brand text-sm font-semibold text-brand-contrast"
      >
        다시 시도
      </button>
    </main>
  );
}
