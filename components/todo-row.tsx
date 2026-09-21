"use client";

import { useState } from "react";

import { deleteTodo, restoreTodo, updateTodo } from "@/app/(tabs)/actions";
import { TodoCheckbox } from "@/components/todo-checkbox";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";

type Todo = {
  id: string;
  content: string;
  done: boolean;
  color: string | null;
  category: { name: string; color: string } | null;
};

/**
 * 할 일 한 줄. "수정"을 누르면 글자를 고치거나 지울 수 있다.
 * 색은 카테고리를 따라가므로 여기서 고르지 않는다.
 */
export function TodoRow({ todo }: { todo: Todo }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-start gap-3 py-3 pr-3">
      <TodoCheckbox
        id={todo.id}
        done={todo.done}
        color={todo.color ?? todo.category?.color}
      />

      <details
        className="group min-w-0 flex-1"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <span
            className={`min-w-0 flex-1 truncate transition-colors ${
              todo.done ? "text-muted line-through" : ""
            }`}
          >
            {todo.content}
          </span>
          <span className="shrink-0 text-xs text-muted group-open:text-brand lg:opacity-0 lg:group-hover/row:opacity-100 lg:group-open:opacity-100">
            수정
          </span>
        </summary>

        <div className="flex flex-col gap-3 pb-1 pt-3">
          <form action={updateTodo} className="flex gap-2">
            <input type="hidden" name="id" value={todo.id} />
            <input
              name="content"
              defaultValue={todo.content}
              maxLength={200}
              required
              aria-label={open ? "할 일 내용 수정" : undefined}
              className="h-11 min-w-0 flex-1 rounded-xl bg-surface-hover px-3 outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-xl bg-surface-hover px-4 text-sm font-medium"
            >
              저장
            </button>
          </form>

          <div className="flex justify-end">
            <UndoableDeleteButton
              id={todo.id}
              remove={deleteTodo}
              restore={restoreTodo}
              message="할 일을 지웠어요"
              className="h-9 rounded-xl px-3 text-sm text-red-500"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
