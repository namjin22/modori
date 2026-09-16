import { ConfirmButton } from "@/components/confirm-button";

import {
  deleteTodo,
  moveTodo,
  toggleTodo,
  updateTodo,
} from "@/app/(tabs)/actions";

type Todo = {
  id: string;
  content: string;
  done: boolean;
  categoryId: string | null;
  category: { name: string; color: string } | null;
};

type Category = { id: string; name: string; color: string };

// 수정 폼은 details로 연다. 이것 때문에 클라이언트 컴포넌트를 만들 이유가 없다.
export function TodoRow({
  todo,
  categories,
}: {
  todo: Todo;
  categories: Category[];
}) {
  return (
    <li className="rounded-2xl bg-surface p-3">
      <div className="flex items-center gap-3">
        <form action={toggleTodo} className="flex">
          <input type="hidden" name="id" value={todo.id} />
          <button
            type="submit"
            aria-label={todo.done ? "완료 취소" : "완료"}
            className={`size-6 rounded-full border-2 text-xs font-bold ${
              todo.done
                ? "border-brand bg-brand text-brand-contrast"
                : "border-border"
            }`}
          >
            {todo.done ? "✓" : ""}
          </button>
        </form>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {todo.category && (
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: todo.category.color }}
            />
          )}
          <span
            className={`truncate ${todo.done ? "text-muted line-through" : ""}`}
          >
            {todo.content}
          </span>
        </div>

        <form action={moveTodo}>
          <input type="hidden" name="id" value={todo.id} />
          <input type="hidden" name="direction" value="up" />
          <button type="submit" aria-label="위로" className="px-1 text-muted">
            ↑
          </button>
        </form>

        <form action={moveTodo}>
          <input type="hidden" name="id" value={todo.id} />
          <input type="hidden" name="direction" value="down" />
          <button type="submit" aria-label="아래로" className="px-1 text-muted">
            ↓
          </button>
        </form>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted">수정</summary>

        <form action={updateTodo} className="mt-2 flex flex-col gap-2">
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

        <form action={deleteTodo} className="mt-2">
          <input type="hidden" name="id" value={todo.id} />
          <ConfirmButton
            message="이 할 일을 지울까요? 되돌릴 수 없습니다."
            className="text-xs text-red-500"
          >
            삭제
          </ConfirmButton>
        </form>
      </details>
    </li>
  );
}
