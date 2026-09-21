"use client";

import { useState } from "react";

import { deleteTodo, restoreTodo, updateTodo } from "@/app/(tabs)/actions";
import { Modal } from "@/components/modal";
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
 * 할 일 한 줄. 글자를 누르면 창이 떠서 그 글자를 바로 고친다.
 * 색은 카테고리를 따라가므로 여기서 고르지 않는다.
 */
export function TodoRow({ todo }: { todo: Todo }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 py-2.5 pr-3">
      <TodoCheckbox
        id={todo.id}
        done={todo.done}
        color={todo.color ?? todo.category?.color}
      />

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`min-w-0 flex-1 truncate text-left transition-colors ${
          todo.done ? "text-muted line-through" : ""
        }`}
      >
        {todo.content}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="할 일">
        {/* 저장 버튼을 두지 않는다. 글자를 고치고 Enter를 누르면 저장된다. */}
        <form
          action={async (formData: FormData) => {
            await updateTodo(formData);
            setOpen(false);
          }}
        >
          <input type="hidden" name="id" value={todo.id} />
          <input
            name="content"
            defaultValue={todo.content}
            maxLength={200}
            required
            autoFocus
            aria-label="할 일 내용 수정"
            className="h-12 w-full rounded-xl bg-surface-hover px-4 text-[15px] outline-none focus:ring-2 focus:ring-brand"
          />
        </form>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Enter로 저장돼요.</p>
          <UndoableDeleteButton
            id={todo.id}
            remove={deleteTodo}
            restore={restoreTodo}
            message="할 일을 지웠어요"
            onDone={() => setOpen(false)}
            className="h-10 rounded-xl px-3 text-sm font-medium text-red-500"
          />
        </div>
      </Modal>
    </div>
  );
}
