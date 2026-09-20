"use client";

import { useState } from "react";

import { deleteTodo, postponeTodo, restoreTodo, updateTodo } from "@/app/(tabs)/actions";
import { ColorSwatches } from "@/components/color-swatches";
import { TodoCheckbox } from "@/components/todo-checkbox";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";

type Todo = { id: string; content: string; done: boolean; categoryId: string | null; color: string | null; routineId: string | null; category: { name: string; color: string } | null };
type Category = { id: string; name: string; color: string };

export function TodoRow({ todo, categories }: { todo: Todo; categories: Category[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-start gap-3 py-2.5 pr-3">
      <TodoCheckbox id={todo.id} done={todo.done} color={todo.color ?? todo.category?.color} />
      <details className="group min-w-0 flex-1" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-2"><span className={`truncate transition-colors ${todo.done ? "text-muted line-through" : ""}`}>{todo.content}</span></div>
          <span className="shrink-0 text-xs text-muted group-open:text-brand lg:opacity-0 lg:group-hover/row:opacity-100 lg:group-open:opacity-100">수정</span>
        </summary>
        <div className="flex flex-col gap-2 pb-3">
          <form action={updateTodo} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={todo.id} />
            <input name="content" defaultValue={todo.content} maxLength={200} required aria-label={open ? "할 일 내용 수정" : undefined} className="h-10 rounded-xl bg-surface-hover px-3" />
            <div className="flex gap-2"><select name="categoryId" defaultValue={todo.categoryId ?? ""} aria-label="카테고리 변경" className="h-10 flex-1 rounded-xl bg-surface-hover px-3 text-sm"><option value="">카테고리 없음</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button type="submit" className="h-10 rounded-xl bg-surface-hover px-4 text-sm font-medium">저장</button></div>
            <ColorSwatches name="color" legend="색" emptyLabel="카테고리 색" defaultValue={todo.color ?? ""} />
          </form>
          <div className="flex items-center justify-end gap-1">{!todo.done && !todo.routineId && <form action={postponeTodo}><input type="hidden" name="id" value={todo.id} /><button type="submit" className="h-9 rounded-xl px-3 text-sm text-muted hover:bg-surface-hover">내일로</button></form>}<UndoableDeleteButton id={todo.id} remove={deleteTodo} restore={restoreTodo} message="할 일을 지웠어요" className="h-9 rounded-xl px-3 text-sm text-red-500" /></div>
        </div>
      </details>
    </div>
  );
}
