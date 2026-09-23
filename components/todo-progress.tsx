"use client";

import { createContext, useContext, useOptimistic, type ReactNode } from "react";

type ChangeDone = (delta: 1 | -1) => void;

const CompletionContext = createContext<ChangeDone | null>(null);

/**
 * 체크박스가 완료 개수를 함께 움직이게 해준다.
 * 서버 액션 안에서 부르면 그 액션이 끝날 때까지만 반영되고, 끝나면 서버 값으로 돌아간다.
 */
export function useCompletionCount(): ChangeDone | null {
  return useContext(CompletionContext);
}

/**
 * 오늘 완료 개수와 진행 막대.
 *
 * useOptimistic은 진행 중인 액션마다 갱신을 겹쳐서 다시 계산한다. 그래서 두 개를
 * 동시에 체크해도 둘 다 반영되고, 서버 응답이 순서를 바꿔 도착해도 마지막에는
 * 서버가 준 값으로 맞춰진다. 직접 상태를 들고 있으면 이 겹침을 흉내 내야 한다.
 */
export function TodoProgress({
  total,
  done,
  children,
}: {
  total: number;
  done: number;
  children: ReactNode;
}) {
  const [optimisticDone, changeDone] = useOptimistic(
    done,
    (current: number, delta: 1 | -1) =>
      Math.max(0, Math.min(total, current + delta)),
  );

  return (
    <CompletionContext.Provider value={changeDone}>
      {/* 할 일이 없어도 자리를 지킨다. 첫 할 일을 적는 순간 막대가 생기면
          화면이 한 번 밀리고, 무엇이 늘었는지도 알아채기 어렵다. */}
      <div className="flex flex-col gap-1">
          <p aria-live="polite" className="text-sm text-muted">
            {total}개 중 {optimisticDone}개 완료
          </p>
          <div
            role="progressbar"
            aria-label="오늘 완료율"
            aria-valuemin={0}
            aria-valuemax={Math.max(total, 1)}
            aria-valuenow={optimisticDone}
            className="h-1.5 overflow-hidden rounded-full bg-border"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300"
              style={{
                width: `${total === 0 ? 0 : Math.round((optimisticDone / total) * 100)}%`,
              }}
            />
          </div>
      </div>
      {children}
    </CompletionContext.Provider>
  );
}
