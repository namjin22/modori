"use client";

import { createContext, useContext, useOptimistic, type ReactNode } from "react";

import { Dori } from "@/components/dori";
import { progressMood } from "@/lib/dori-mood";

/** 할 일 하나를 끝냈거나 되돌렸다. */
type ChangeDone = (id: string, done: boolean) => void;

/** 진행 막대에 필요한 할 일 한 줄. color가 없으면 브랜드 색. 화면에 보이는 순서대로 넘긴다. */
export type ProgressItem = { id: string; done: boolean; color: string | null };

const CompletionContext = createContext<ChangeDone | null>(null);

/**
 * 체크박스가 완료 개수와 막대를 함께 움직이게 해준다.
 * 서버 액션 안에서 부르면 그 액션이 끝날 때까지만 반영되고, 끝나면 서버 값으로 돌아간다.
 */
export function useCompletionCount(): ChangeDone | null {
  return useContext(CompletionContext);
}

/**
 * 오늘 완료 개수와 진행 막대. 막대는 끝낸 할 일 하나마다 그 카테고리 색으로 한 칸씩 찬다.
 *
 * useOptimistic은 진행 중인 액션마다 갱신을 겹쳐서 다시 계산한다. 그래서 두 개를
 * 동시에 체크해도 둘 다 반영되고, 서버 응답이 순서를 바꿔 도착해도 마지막에는
 * 서버가 준 값으로 맞춰진다. 개수가 아니라 어느 할 일을 끝냈는지 들고 있어야 색을 칠할 수 있다.
 */
export function TodoProgress({
  items,
  canCelebrate,
  children,
}: {
  items: ProgressItem[];
  // 앞날에 아직 "예정"인 루틴이 남아 있으면 다 끝낸 날이 아니다.
  canCelebrate: boolean;
  children: ReactNode;
}) {
  const [optimisticItems, changeDone] = useOptimistic(
    items,
    (current: ProgressItem[], change: { id: string; done: boolean }) =>
      current.map((item) => (item.id === change.id ? { ...item, done: change.done } : item)),
  );
  const total = optimisticItems.length;
  const doneItems = optimisticItems.filter((item) => item.done);
  const optimisticDone = doneItems.length;

  // 다 끝낸 날은 알아봐 준다. 마지막 하나를 체크할 동기가 된다. 체크하는 즉시(서버 응답 전) 뜬다.
  const celebrating = canCelebrate && total > 0 && optimisticDone >= total;
  // 축하 배너에 도리가 있으니 진행률 옆 도리는 뺀다. 둘이 같이 있으면 어색하다.
  const mood = celebrating ? null : progressMood(optimisticDone, total);

  return (
    <CompletionContext.Provider value={(id, done) => changeDone({ id, done })}>
      {celebrating && (
        <div className="flex items-center gap-3 rounded-2xl bg-brand-subtle px-4 py-3">
          <Dori mood="party" size={56} />
          <div>
            <p className="font-semibold text-brand">할 일을 다 끝냈어요</p>
            <p className="text-xs text-muted">도리가 대신 박수 쳐줄게요</p>
          </div>
        </div>
      )}
      {/* 할 일이 없어도 자리를 지킨다. 첫 할 일을 적는 순간 막대가 생기면
          화면이 한 번 밀리고, 무엇이 늘었는지도 알아채기 어렵다. */}
      <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            {/* 체크할 때마다 표정이 따라 바뀐다. 숫자만 오르는 것보다 한 번 더 누르고 싶어진다. */}
            {mood && <Dori mood={mood} size={28} className="-my-1" />}
            <p aria-live="polite" className="text-sm text-muted">
              {total}개 중 {optimisticDone}개 완료
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="오늘 완료율"
            aria-valuemin={0}
            aria-valuemax={Math.max(total, 1)}
            aria-valuenow={optimisticDone}
            className="flex h-1.5 gap-px overflow-hidden rounded-full bg-border"
          >
            {/* 끝낸 일 하나가 한 칸. 목록 순서라 같은 카테고리 색이 붙어 선다. 칸 사이 1px 틈이
                흰색·검정 카테고리처럼 막대 바탕과 비슷한 색도 칸으로 보이게 한다. */}
            {doneItems.map((item) => (
              <div
                key={item.id}
                data-progress-color={item.color ?? "brand"}
                className="h-full shrink-0 bg-brand transition-[width] duration-300"
                style={{
                  width: `${100 / total}%`,
                  ...(item.color ? { backgroundColor: item.color } : {}),
                }}
              />
            ))}
          </div>
      </div>
      {children}
    </CompletionContext.Provider>
  );
}
