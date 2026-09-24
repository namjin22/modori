import { ColorSwatches } from "@/components/color-swatches";
import { PALETTE } from "@/lib/colors";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { createCategory, restoreCategory } from "./actions";
import { BackLink } from "@/components/back-link";
import { CategoryEditor } from "@/components/category-editor";

// 브랜드 파랑을 기본값으로 두면 새 카테고리가 버튼 색과 구분되지 않는다.
const DEFAULT_NEW_COLOR = PALETTE[0].value;

export default async function CategoriesPage() {
  const user = await requireUser();

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { order: "asc" },
  });

  const active = categories.filter((category) => !category.archivedAt);
  const archived = categories.filter((category) => category.archivedAt);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/" label="피드로" />
        <h1 className="text-2xl font-bold">카테고리</h1>
      </header>

      <form
        action={createCategory}
        className="flex flex-col gap-4 rounded-2xl bg-surface p-4"
      >
        <div className="flex gap-2">
          <input
            name="name"
            required
            maxLength={20}
            placeholder="새 카테고리"
            aria-label="새 카테고리 이름"
            className="h-11 min-w-0 flex-1 rounded-xl bg-surface-hover px-3"
          />
          <SubmitButton
            pendingLabel="추가 중"
            className="h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast"
          >
            추가
          </SubmitButton>
        </div>
        <ColorSwatches
          name="color"
          legend="색"
          defaultValue={DEFAULT_NEW_COLOR}
        />
      </form>

      {active.length === 0 ? (
        <p className="rounded-2xl bg-surface p-10 text-center text-sm text-muted">
          아직 카테고리가 없어요
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map((category) => (
            <CategoryEditor key={category.id} category={category} />
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">보관함</h2>
          <p className="text-xs text-muted">
            지운 카테고리는 예전 기록의 색까지 가져가요. 그래서 보관만 해요.
          </p>
          <ul className="flex flex-col gap-3">
            {archived.map((category) => (
              <li
                key={category.id}
                className="flex items-center gap-3 rounded-2xl bg-surface p-4"
              >
                <span
                  aria-hidden
                  className="size-4 shrink-0 color-edge rounded-full opacity-40"
                  style={{ backgroundColor: category.color }}
                />
                <span className="flex-1 truncate text-muted">{category.name}</span>
                <form action={restoreCategory}>
                  <input type="hidden" name="id" value={category.id} />
                  <button type="submit" className="h-8 rounded-lg px-2 text-xs font-medium text-brand hover:bg-surface-hover">
                    되돌리기
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
