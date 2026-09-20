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

const DEFAULT_NEW_COLOR = "#2563eb";

// 브라우저 기본 색 입력은 회색 테두리 안에 네모가 들어 있어 거칠어 보인다.
// 테두리와 안쪽 여백을 걷어내고 둥근 견본 하나로 만든다.
const COLOR_SWATCH =
  "size-10 shrink-0 cursor-pointer appearance-none self-center rounded-full border-0 bg-transparent p-0 " +
  "[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 " +
  "[&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0";

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
        <Link href="/" aria-label="피드로" className="text-muted">
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
          className={COLOR_SWATCH}
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
            // 오늘 화면의 할 일 줄과 같은 모양으로 맞춘다. 접었을 때는 색, 이름,
            // "수정"만 보이고, 순서 화살표와 보관은 펼쳤을 때 나온다.
            <li key={category.id} className="rounded-2xl bg-surface">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="flex-1 truncate font-medium">
                    {category.name}
                  </span>
                  {!category.isPublic && (
                    <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-muted">
                      비공개
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-muted group-open:text-brand">
                    수정
                  </span>
                </summary>

                <div className="flex flex-col gap-3 px-3 pb-3">
                  <form action={updateCategory} className="flex flex-col gap-2">
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
                        className={COLOR_SWATCH}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        name="isPublic"
                        defaultChecked={category.isPublic}
                        className="size-4 accent-brand"
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

                  <div className="flex items-center gap-2">
                    <form action={moveCategory}>
                      <input type="hidden" name="id" value={category.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        aria-label="위로"
                        className="h-9 rounded-xl bg-surface-hover px-3 text-muted"
                      >
                        ↑
                      </button>
                    </form>
                    <form action={moveCategory}>
                      <input type="hidden" name="id" value={category.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        aria-label="아래로"
                        className="h-9 rounded-xl bg-surface-hover px-3 text-muted"
                      >
                        ↓
                      </button>
                    </form>

                    <form action={archiveCategory} className="ml-auto">
                      <input type="hidden" name="id" value={category.id} />
                      <button
                        type="submit"
                        className="h-9 rounded-xl px-3 text-sm text-muted"
                      >
                        보관하기
                      </button>
                    </form>
                  </div>
                </div>
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
