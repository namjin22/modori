"use client";

import { useTransition } from "react";

import { useToast } from "@/components/toast";

/**
 * 누르면 확인 없이 바로 지우고, 아래에 "되돌리기"를 띄운다.
 * 확인창은 매번 한 번 더 누르게 만들면서도 습관적으로 넘기게 되어 실수를 잘
 * 못 막는다. 지운 뒤 되살릴 수 있는 편이 빠르고 안전하다.
 */
export function UndoableDeleteButton<Snapshot>({
  id,
  remove,
  restore,
  message,
  onDone,
  className,
}: {
  id: string;
  remove: (id: string) => Promise<Snapshot | null>;
  restore: (snapshot: Snapshot) => Promise<void>;
  message: string;
  // 떠 있는 창 안에서 지웠으면 그 창도 닫아야 한다.
  onDone?: () => void;
  className?: string;
}) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const snapshot = await remove(id);
        // 이미 없는 항목이다. 다른 탭에서 먼저 지웠을 수 있다.
        if (!snapshot) return;

        toast({
          message,
          action: { label: "되돌리기", run: () => restore(snapshot) },
        });
      } catch (error) {
        console.error("[delete] 지우지 못했다.", error);
        toast({ message: "지우지 못했어요. 다시 시도해주세요." });
      } finally {
        onDone?.();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`${className ?? ""} disabled:opacity-50`}
    >
      삭제
    </button>
  );
}
