"use client";

import { useEffect, useRef, useState } from "react";

import { useCompletionCount } from "@/components/todo-progress";

export function TodoCheckbox({
  id,
  done,
  color,
}: {
  id: string;
  done: boolean;
  color?: string;
}) {
  const [optimisticDone, setOptimisticDone] = useState(done);
  const [hydrated, setHydrated] = useState(false);
  const clickHandled = useRef(false);
  const completion = useCompletionCount();

  useEffect(() => {
    const stored = sessionStorage.getItem(`modori:todo-done:${id}`);
    const timer = window.setTimeout(() => {
      if (stored !== null) setOptimisticDone(stored === "true");
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  async function toggle() {
    const nextDone = !optimisticDone;
    setOptimisticDone(nextDone);
    sessionStorage.setItem(`modori:todo-done:${id}`, String(nextDone));
    completion?.changeDone(nextDone ? 1 : -1);
    completion?.beginToggle();
    try {
      const response = await fetch("/api/todos/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, done: nextDone }),
      });
      if (!response.ok) throw new Error(`할 일을 저장하지 못했다: ${response.status}`);
    } catch (error) {
      setOptimisticDone(!nextDone);
      sessionStorage.setItem(`modori:todo-done:${id}`, String(!nextDone));
      completion?.changeDone(nextDone ? -1 : 1);
      console.error(error);
    } finally {
      completion?.endToggle();
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    if (!hydrated) return;
    event.preventDefault();
    if (clickHandled.current) {
      clickHandled.current = false;
      return;
    }
    await toggle();
  }

  return (
    <form action="/api/todos/toggle" method="post" onSubmit={submit} className="flex">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="done" value={optimisticDone ? "false" : "true"} />
      <button type="submit" aria-label={optimisticDone ? "완료 취소" : "완료"} onClick={() => { if (hydrated) { clickHandled.current = true; void toggle(); } }} style={color && optimisticDone ? { backgroundColor: color } : undefined} className={`flex size-[22px] shrink-0 items-center justify-center rounded-[7px] text-xs font-bold text-white transition-all duration-150 active:scale-90 ${optimisticDone ? "bg-brand" : "bg-border hover:brightness-95"}`}>
        {optimisticDone ? "✓" : ""}
      </button>
    </form>
  );
}
