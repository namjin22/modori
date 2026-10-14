"use client";

import { type ReactNode, useRef } from "react";

import { useSwapIn } from "@/lib/motion";

/** 서버 컴포넌트·훅을 쓰지 않는 부품(달력 등)에서 날·달이 바뀔 때 미끄러져 들어오게 감싼다(lib/motion.ts). */
export function SwapIn({ swapKey, className, children }: { swapKey: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useSwapIn(ref, swapKey);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
