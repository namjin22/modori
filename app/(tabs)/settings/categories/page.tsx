import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import {
  archiveCategory,
  createCategory,
  moveCategory,
  restoreCategory,
  updateCategory,
} from "./actions";

const DEFAULT_NEW_COLOR = "#00b26a";

export default async function CategoriesPage() {
  const user = await requireUser();

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { order: "asc" },
  });

  const active = categories.filter((category) => !category.archivedAt);
  const archived = categories.filter((category) => category.archivedAt);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link href="/settings" aria-label="설정으로" className="text-muted">
          ←
        </Link>
        <h1 className="text-2xl font-bold">카테고리</h1>
      </header>

      <form
        action={createCategory}
        className="flex gap-2 rounded-2xl bg-surface p-3"
      >
        <input
          name="name"
          required
          maxLength={20}
          placeholder="새 카테고리"
          aria-label="새 카테고리 이름"
          className="h-11 min-w-0 flex-1 rounded-xl bg-surface-hover px-3"
        />
        <input
          type="color"
          name="color"
          defaultValue={DEFAULT_NEW_COLOR}
          aria-label="새 카테고리 색"
          className="h-11 w-12 rounded-xl bg-surface-hover"
        />
        <SubmitButton
          pendingLabel="추가 중"
          className="h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast"
        >
          추가
        </SubmitButton>
      </form>

      {active.length === 0 ? (
        <p className="rounded-2xl bg-surface p-10 text-center text-sm text-muted">
          카테고리가 없다
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((category) => (
            <li key={category.id} className="rounded-2xl bg-surface p-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="flex-1 truncate font-medium">
                  {category.name}
                </span>
                {!category.isPublic && (
                  <span className="text-xs text-muted">비공개</span>
                )}

                <form action={moveCategory}>
                  <input type="hidden" name="id" value={category.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button type="submit" aria-label="위로" className="px-1 text-muted">
                    ↑
                  </button>
                </form>

                <form action={moveCategory}>
                  <input type="hidden" name="id" value={category.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button type="submit" aria-label="아래로" className="px-1 text-muted">
                    ↓
                  </button>
                </form>
              </div>

              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted">
                  수정
                </summary>

                <form action={updateCategory} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="id" value={category.id} />
                  <div className="flex gap-2">
                    <input
                      name="name"
                      defaultValue={category.name}
                      maxLength={20}
                      required
                      aria-label={`${category.name} 이름`}
                      className="h-10 min-w-0 flex-1 rounded-xl bg-surface-hover px-3"
                    />
                    <input
                      type="color"
                      name="color"
                      defaultValue={category.color}
                      aria-label={`${category.name} 색`}
                      className="h-10 w-12 rounded-xl bg-surface-hover"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      name="isPublic"
                      defaultChecked={category.isPublic}
                    />
                    친구 피드에 보이기
                  </label>
                  <button
                    type="submit"
                    className="h-10 rounded-xl bg-surface-hover text-sm font-medium"
                  >
                    저장
                  </button>
                </form>

                <form action={archiveCategory} className="mt-2">
                  <input type="hidden" name="id" value={category.id} />
                  <button type="submit" className="text-xs text-muted">
                    보관하기
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">보관함</h2>
          <p className="text-xs text-muted">
            지나간 기록의 색을 지키려고 삭제 대신 보관한다.
          </p>
          <ul className="flex flex-col gap-2">
            {archived.map((category) => (
              <li
                key={category.id}
                className="flex items-center gap-3 rounded-2xl bg-surface p-3"
              >
                <span
                  aria-hidden
                  className="size-4 shrink-0 rounded-full opacity-40"
                  style={{ backgroundColor: category.color }}
                />
                <span className="flex-1 truncate text-muted">{category.name}</span>
                <form action={restoreCategory}>
                  <input type="hidden" name="id" value={category.id} />
                  <button type="submit" className="text-xs text-brand">
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
