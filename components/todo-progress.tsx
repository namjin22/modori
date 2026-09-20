"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const optimisticCounts = new Map<string, number>();

type CompletionContextValue = {
  changeDone: (delta: 1 | -1) => void;
  beginToggle: () => void;
  endToggle: () => void;
};
const CompletionContext = createContext<CompletionContextValue | null>(null);

export function useCompletionCount() {
  return useContext(CompletionContext);
}

export function TodoProgress({
  total,
  done,
  scope,
  children,
}: {
  total: number;
  done: number;
  scope: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [doneCount, setDoneCount] = useState(() => optimisticCounts.get(scope) ?? done);
  const [pendingToggles, setPendingToggles] = useState(0);
  const hadPendingToggle = useRef(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(`modori:done-count:${scope}`);
    const value = stored === null ? null : Number(stored);
    if (value === null || !Number.isInteger(value) || value < 0 || value > total) return;
    const timer = window.setTimeout(() => setDoneCount(value), 0);
    return () => window.clearTimeout(timer);
  }, [scope, total]);

  useEffect(() => {
    if (pendingToggles > 0) {
      hadPendingToggle.current = true;
      return;
    }
    if (hadPendingToggle.current) {
      hadPendingToggle.current = false;
      router.refresh();
    }
  }, [pendingToggles, router]);

  const context = useMemo<CompletionContextValue>(
    () => ({
      changeDone: (delta) =>
        setDoneCount((current) => {
          const next = Math.max(0, Math.min(total, current + delta));
          optimisticCounts.set(scope, next);
          sessionStorage.setItem(`modori:done-count:${scope}`, String(next));
          return next;
        }),
      beginToggle: () => setPendingToggles((current) => current + 1),
      endToggle: () => setPendingToggles((current) => Math.max(0, current - 1)),
    }),
    [scope, total],
  );

  return (
    <CompletionContext.Provider value={context}>
      {total > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted">
            {total}개 중 {doneCount}개 완료
          </p>
          <div
            role="progressbar"
            aria-label="오늘 완료율"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={doneCount}
            className="h-1.5 overflow-hidden rounded-full bg-border"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300"
              style={{ width: `${Math.round((doneCount / total) * 100)}%` }}
            />
          </div>
        </div>
      )}
      {children}
    </CompletionContext.Provider>
  );
}
