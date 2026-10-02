"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

import { Dori } from "@/components/dori";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // 화면에는 사람이 읽을 말만 보여주고, 원인은 로그에 남긴다.
    console.error("[error]", error);
    // 서버에서 난 오류는 digest가 붙어 오고 서버가 이미 기록했다(instrumentation.ts).
    // 브라우저에서만 난 오류만 보낸다. 페이지를 떠나도 전송되게 sendBeacon을 쓴다.
    if (!error.digest) {
      navigator.sendBeacon(
        "/api/errors",
        JSON.stringify({ message: `${error.name}: ${error.message}`, path: location.pathname }),
      );
    }
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
        onClick={() => {
          // reset만 부르면 서버에서 난 오류(DB가 잠깐 끊김)는 다시 받아오지 않아 같은 오류 화면이 남는다. 새로 받아오며 다시 그린다.
          startTransition(() => {
            router.refresh();
            reset();
          });
        }}
        className="h-12 w-full rounded-2xl bg-brand text-sm font-semibold text-brand-contrast"
      >
        다시 시도
      </button>
    </main>
  );
}
