"use client";

import { useLinkStatus } from "next/link";

/**
 * 링크를 누른 뒤 새 화면이 오기 전까지 그 링크 위에 옅게 깜빡이는 표시. 누른 것이 먹혔는지 바로 알 수 있다.
 * 미리 받아 둔 화면이면 바로 바뀌어서 거의 보이지 않는다. 부모 링크에 relative가 있어야 한다.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 rounded-[inherit] bg-brand/15 transition-opacity ${
        pending ? "animate-pulse opacity-100" : "opacity-0"
      }`}
    />
  );
}
