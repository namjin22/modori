import { completeScheduledRoutine } from "@/app/(tabs)/actions";

type ScheduledRoutine = {
  id: string;
  content: string;
  categoryId: string | null;
};

type Category = { id: string; name: string; color: string };

// 미래 날짜의 루틴은 아직 DB에 행이 없다. 체크하는 순간 처음 만들어진다.
export function ScheduledRoutineRow({
  routine,
  categories,
  date,
}: {
  routine: ScheduledRoutine;
  categories: Category[];
  date: string;
}) {
  const color = categories.find(
    (category) => category.id === routine.categoryId,
  )?.color;

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-3">
      <form action={completeScheduledRoutine} className="flex">
        <input type="hidden" name="routineId" value={routine.id} />
        <input type="hidden" name="date" value={date} />
        <button
          type="submit"
          aria-label="미리 완료"
          className="size-6 rounded-full border-2 border-border"
        />
      </form>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {color && (
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="truncate text-muted">{routine.content}</span>
      </div>

      <span className="shrink-0 text-xs text-muted">예정</span>
    </li>
  );
}
