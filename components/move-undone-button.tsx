"use client";

import { useTransition } from "react";

import { moveUndoneToToday } from "@/app/(tabs)/actions";
import { useTodoStore } from "@/components/todo-store";
import { useToast } from "@/components/toast";
import { useSaveFailure } from "@/components/use-save-failure";

/** 오늘이 아닌 날(지난 날·앞날) 화면의 "안 끝낸 일 N개 모두 오늘 하기". 오늘 화면이 아니므로 누르면 그 날 목록에서 사라지고 알림이 뜬다. */
export function MoveUndoneButton({ date, today, count }: { date: string; today: string; count: number }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const saveFailed = useSaveFailure();
  const store = useTodoStore();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // 누르는 즉시 오늘로 옮겨 보여 준다. 오늘 하루 상한에 걸리면 서버 응답 뒤 남은 것이 돌아온다.
          store?.({ type: "moveUndone", from: date, to: today });
          try {
            const result = await moveUndoneToToday(date);
            toast({ message: result.message });
          } catch (error) {
            saveFailed(error);
          }
        })
      }
      className="h-11 w-full rounded-2xl border border-border text-sm font-medium disabled:opacity-50"
    >
      {pending ? "옮기는 중" : `안 끝낸 일 ${count}개 모두 오늘 하기`}
    </button>
  );
}
