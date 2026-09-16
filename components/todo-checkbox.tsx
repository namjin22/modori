"use client";

import { useOptimistic } from "react";

import { toggleTodo } from "@/app/(tabs)/actions";

// 서버 왕복을 기다렸다가 체크 표시를 바꾸면 손가락보다 화면이 한참 늦다.
// 먼저 바꿔 보여주고, 서버 응답이 오면 진짜 값으로 맞춰진다.
export function TodoCheckbox({ id, done }: { id: string; done: boolean }) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);

  return (
    <form
      action={async (formData: FormData) => {
        setOptimisticDone(!optimisticDone);
        await toggleTodo(formData);
      }}
      className="flex"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={optimisticDone ? "완료 취소" : "완료"}
        className={`size-6 rounded-full border-2 text-xs font-bold transition-all duration-150 active:scale-90 ${
          optimisticDone
            ? "border-brand bg-brand text-brand-contrast"
            : "border-border hover:border-brand"
        }`}
      >
        {optimisticDone ? "✓" : ""}
      </button>
    </form>
  );
}
