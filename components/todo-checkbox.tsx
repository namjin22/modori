"use client";

import { useOptimistic } from "react";

import { useCompletionCount } from "@/components/todo-progress";

import { toggleTodo } from "@/app/(tabs)/actions";

// 서버 왕복을 기다렸다가 체크 표시를 바꾸면 손가락보다 화면이 한참 늦다.
// 먼저 바꿔 보여주고, 서버 응답이 오면 진짜 값으로 맞춰진다.
export function TodoCheckbox({
  id,
  done,
  color,
}: {
  id: string;
  done: boolean;
  // 카테고리 색. 카테고리를 고르지 않은 할 일은 브랜드 색을 쓴다.
  color?: string;
}) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const changeDone = useCompletionCount();

  return (
    <form
      action={async (formData: FormData) => {
        const next = !optimisticDone;
        setOptimisticDone(next);
        // 완료 개수도 같은 액션 안에서 움직여야 둘이 따로 놀지 않는다.
        changeDone?.(next ? 1 : -1);
        await toggleTodo(formData);
      }}
      className="flex"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={optimisticDone ? "완료 취소" : "완료"}
        // 투두메이트처럼 둥근 네모. 안 한 일은 회색으로 채우고, 한 일은 카테고리 색으로 채운다.
        style={color && optimisticDone ? { backgroundColor: color } : undefined}
        className={`flex size-[22px] shrink-0 items-center justify-center rounded-[7px] text-xs font-bold text-white transition-all duration-150 active:scale-90 ${
          optimisticDone ? "bg-brand" : "bg-border hover:brightness-95"
        }`}
      >
        {optimisticDone ? "✓" : ""}
      </button>
    </form>
  );
}
