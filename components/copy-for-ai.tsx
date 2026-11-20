"use client";

import { useEffect, useRef, useState } from "react";

import { useT } from "@/components/locale-provider";
import { common } from "@/lib/i18n/messages/common";

// 복사했다는 표시를 보여 주는 시간. 창 안이라 토스트(창 뒤에 가려진다) 대신 단추 글자를 잠깐 바꾼다.
const COPIED_MS = 2500;

/**
 * 할 일·일정 창 맨 밑의 "AI용으로 복사"(2026-11-20). 넘겨받은 글(lib/ai-reference.ts)을 클립보드에 넣는다.
 * 복사가 막힌 곳(권한·오래된 웹뷰)에서는 이유를 알리고 글을 보여 줘서 직접 복사할 수 있게 한다.
 */
export function CopyForAi({ text }: { text: string }) {
  const t = useT(common);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      timer.current = setTimeout(() => setState("idle"), COPIED_MS);
    } catch (error) {
      console.warn("[copy-for-ai] 클립보드에 복사하지 못했다.", error);
      setState("failed");
    }
  }

  return (
    <div className="-mt-2 flex flex-col items-center gap-2">
      <button type="button" onClick={copy} className="h-9 rounded-xl px-3 text-xs font-medium text-muted hover:text-foreground">
        {state === "copied" ? t("copiedForAi") : t("copyForAi")}
      </button>
      {state === "failed" && (
        <>
          <p role="alert" className="text-xs text-danger">
            {t("copyForAiFailed")}
          </p>
          <textarea
            readOnly
            value={text}
            rows={5}
            aria-label={t("copyForAi")}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full resize-none rounded-xl bg-surface-hover px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-brand"
          />
        </>
      )}
    </div>
  );
}
