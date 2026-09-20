export function QuickAddForm({ categories, date }: { categories: { id: string; name: string; color: string }[]; date: string }) {
  return (
    <form action="/api/todos" method="post" className="mt-2 flex flex-col gap-2 border-t border-dashed border-border pt-4">
      <input type="hidden" name="date" value={date} />
      <div className="flex gap-2">
        <input name="content" required maxLength={200} placeholder="할 일 추가" aria-label="할 일 내용" className="h-10 min-w-0 flex-1 rounded-xl bg-surface px-3 text-[15px] outline-none placeholder:text-muted focus:ring-2 focus:ring-brand" />
        <button type="submit" className="h-10 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast">추가</button>
      </div>
      <select name="categoryId" aria-label="카테고리" className="h-9 rounded-xl bg-surface px-3 text-sm text-muted">
        <option value="">카테고리 없음</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
    </form>
  );
}
