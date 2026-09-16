import { ConfirmButton } from "@/components/confirm-button";
import { TodoCheckbox } from "@/components/todo-checkbox";

import { deleteTodo, moveTodo, updateTodo } from "@/app/(tabs)/actions";

type Todo = {
  id: string;
  content: string;
  done: boolean;
  categoryId: string | null;
  category: { name: string; color: string } | null;
};

type Category = { id: string; name: string; color: string };

// 수정 폼은 details로 연다. 이것 때문에 클라이언트 컴포넌트를 만들 이유가 없다.
// 접었을 때 보이는 것은 체크, 내용, "수정"뿐이다. 순서 바꾸기 화살표까지 항상
// 내놓으면 한 줄에 버튼이 넷이라, 할 일 목록이 아니라 조작판처럼 보인다.
export function TodoRow({
  todo,
  categories,
}: {
  todo: Todo;
  categories: Category[];
}) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 pr-3 [&::-webkit-details-marker]:hidden">
        <TodoCheckbox id={todo.id} done={todo.done} />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {todo.category && (
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: todo.category.color }}
            />
          )}
          <span
            className={`truncate transition-colors ${
              todo.done ? "text-muted line-through" : ""
            }`}
          >
            {todo.content}
          </span>
        </div>

        <span className="shrink-0 text-xs text-muted group-open:text-brand">
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

        <div className="flex items-center gap-2">
          {/* 드래그가 어려운 상황(키보드, 손 떨림)을 위해 화살표를 남긴다. */}
          <form action={moveTodo}>
            <input type="hidden" name="id" value={todo.id} />
            <input type="hidden" name="direction" value="up" />
            <button
              type="submit"
              aria-label="위로"
              className="h-9 rounded-xl bg-surface-hover px-3 text-muted"
            >
              ↑
            </button>
          </form>

          <form action={moveTodo}>
            <input type="hidden" name="id" value={todo.id} />
            <input type="hidden" name="direction" value="down" />
            <button
              type="submit"
              aria-label="아래로"
              className="h-9 rounded-xl bg-surface-hover px-3 text-muted"
            >
              ↓
            </button>
          </form>

          <form action={deleteTodo} className="ml-auto">
            <input type="hidden" name="id" value={todo.id} />
            <ConfirmButton
              message="이 할 일을 지울까요? 되돌릴 수 없습니다."
              className="h-9 rounded-xl px-3 text-sm text-red-500"
            >
              삭제
            </ConfirmButton>
          </form>
        </div>
      </div>
    </details>
  );
}
