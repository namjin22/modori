import { SubmitButton } from "@/components/submit-button";

import { addTodo } from "@/app/(tabs)/actions";

/**
 * 카테고리를 골라서 적는 공용 입력. 주로는 칩의 +로 적고, 이 폼은 카테고리 없이
 * 빨리 적거나 고르면서 적고 싶을 때 쓴다. 그래서 목록 아래에 조용히 둔다.
 *
 * 서버 액션으로 보낸다. 라우트로 POST하면 페이지가 통째로 다시 열려서,
 * 적는 동안 목록이 사라졌다가 다시 그려진다.
 */
export function QuickAddForm({
  categories,
  date,
}: {
  categories: { id: string; name: string; color: string }[];
  date: string;
}) {
  return (
    <form
      action={addTodo}
      className="mt-2 flex flex-col gap-2 border-t border-dashed border-border pt-4"
    >
      <input type="hidden" name="date" value={date} />
      <div className="flex gap-2">
        <input
          name="content"
          required
          maxLength={200}
          placeholder="할 일 추가"
          aria-label="할 일 내용"
          className="h-10 min-w-0 flex-1 rounded-xl bg-surface px-3 text-[15px] outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
        />
        <SubmitButton
          pendingLabel="추가 중"
          className="h-10 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast"
        >
          추가
        </SubmitButton>
      </div>
      <select
        name="categoryId"
        aria-label="카테고리"
        className="h-9 rounded-xl bg-surface px-3 text-sm text-muted"
      >
        <option value="">카테고리 없음</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </form>
  );
}
