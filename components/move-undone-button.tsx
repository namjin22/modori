"use client";

import { useTransition } from "react";

import { moveUndoneToToday, moveUndoneToTomorrow, restoreUndone } from "@/app/(tabs)/actions";
import { useTodoStore } from "@/components/todo-store";
import { useToast } from "@/components/toast";
import { useSaveFailure } from "@/components/use-save-failure";
import { addDays, formatKST, parseKSTDate } from "@/lib/date";

/**
 * 안 끝낸 할 일을 한꺼번에 옮기는 버튼. 목록의 맨 아래(가장 밑의 할 일 아래)에 둔다.
 * (이름에 "옮기기"를 넣지 않았다. 할 일 창의 "옮기기" 버튼과 접근성 이름이 겹쳐 시험·화면 읽기에서 구별이 안 됐다.)
 * 일정 바로 밑에 두었더니 매일 눈에 띄어 잘못 누르기 쉽고 할 일을 밀어 내렸다(2026-10-14 요청).
 * 한때 접힌 버튼을 누르면 이 버튼이 나오게 했는데, 같은 뜻의 버튼이 두 번 나와 어색했다(2026-10-16 요청). 버튼 하나로 바로 옮기고,
 * 잘못 눌렀으면 알림의 "되돌리기"로 원래 날·순서·루틴 연결까지 돌린다(restoreUndone).
 * - 오늘 화면: 오늘 못 끝낸 일 모두 → 내일
 * - 오늘이 아닌 날(지난 날·앞날): 안 끝낸 일 모두 → 오늘
 * 누르면 그 날 목록에서 먼저 사라지고(서버 응답 전) 알림이 뜬다. 하루 상한에 걸리면 들어가는 만큼만 옮기고 남은 수를 알린다.
 */
export function BulkMove({ date, today, count }: { date: string; today: string; count: number }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const saveFailed = useSaveFailure();
  const store = useTodoStore();

  const toTomorrow = date === today;
  const target = toTomorrow ? formatKST(addDays(parseKSTDate(today), 1)) : today;
  const word = toTomorrow ? "내일" : "오늘";

  function run() {
    startTransition(async () => {
      store?.({ type: "moveUndone", from: date, to: target });
      try {
        const result = await (toTomorrow ? moveUndoneToTomorrow(date) : moveUndoneToToday(date));
        const undo = result.undo;
        toast({
          message: result.message,
          ...(undo && { action: { label: "되돌리기", run: () => restoreUndone(undo) } }),
        });
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  if (count === 0) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={run}
      className="mt-2 h-11 w-full rounded-2xl border border-dashed border-border text-sm text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
    >
      {pending ? "옮기는 중" : `안 끝낸 일 ${count}개 모두 ${word} 하기`}
    </button>
  );
}
