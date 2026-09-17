import { TodoCheckbox } from "@/components/todo-checkbox";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";

import {
  deleteTodo,
  postponeTodo,
  restoreTodo,
  updateTodo,
} from "@/app/(tabs)/actions";

type Todo = {
  id: string;
  content: string;
  done: boolean;
  categoryId: string | null;
  routineId: string | null;
  category: { name: string; color: string } | null;
};

type Category = { id: string; name: string; color: string };

// 수정 폼은 details로 연다. 이것 때문에 클라이언트 컴포넌트를 만들 이유가 없다.
// 접었을 때 보이는 것은 체크, 내용, "수정"뿐이다.
// 순서는 손잡이를 끌거나, 손잡이에서 스페이스와 방향키로 바꾼다.
export function TodoRow({
  todo,
  categories,
}: {
  todo: Todo;
  categories: Category[];
}) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 pr-3 [&::-webkit-details-marker]:hidden">
        <TodoCheckbox
          id={todo.id}
          done={todo.done}
          color={todo.category?.color}
        />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={`truncate transition-colors ${
              todo.done ? "text-muted line-through" : ""
            }`}
          >
            {todo.content}
          </span>
        </div>

        <span className="shrink-0 text-xs text-muted group-open:text-brand lg:opacity-0 lg:group-hover/row:opacity-100 lg:group-open:opacity-100">
          수정
        </span>
      </summary>

      <div className="flex flex-col gap-2 pb-3 pr-3">
        <form action={updateTodo} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={todo.id} />
          <input
            name="content"
            defaultValue={todo.content}
            maxLength={200}
            required
            aria-label="할 일 내용 수정"
            className="h-10 rounded-xl bg-surface-hover px-3"
          />
          <div className="flex gap-2">
            <select
              name="categoryId"
              defaultValue={todo.categoryId ?? ""}
              aria-label="카테고리 변경"
              className="h-10 flex-1 rounded-xl bg-surface-hover px-3 text-sm"
            >
              <option value="">카테고리 없음</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-10 rounded-xl bg-surface-hover px-4 text-sm font-medium"
            >
              저장
            </button>
          </div>
        </form>

        <div className="flex items-center justify-end gap-1">
          {/* 루틴 할 일은 내일 또 생기므로 미루지 않는다. 끝낸 일도 미룰 이유가 없다. */}
          {!todo.done && !todo.routineId && (
            <form action={postponeTodo}>
              <input type="hidden" name="id" value={todo.id} />
              <button
                type="submit"
                className="h-9 rounded-xl px-3 text-sm text-muted hover:bg-surface-hover"
              >
                내일로
              </button>
            </form>
          )}
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
  );
}
