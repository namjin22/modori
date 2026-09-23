import { ColorSwatches } from "@/components/color-swatches";
import { PALETTE } from "@/lib/colors";
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
import { BackLink } from "@/components/back-link";

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
            // 오늘 화면의 할 일 줄과 같은 모양으로 맞춘다. 접었을 때는 색, 이름,
            // "수정"만 보이고, 순서 화살표와 보관은 펼쳤을 때 나온다.
            <li key={category.id} className="rounded-2xl bg-surface">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden
                    className="size-4 shrink-0 color-edge rounded-full"
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

                <div className="flex flex-col gap-4 px-3 pb-3">
                  <form action={updateCategory} className="flex flex-col gap-3">
                    <input type="hidden" name="id" value={category.id} />
                    <input
                      name="name"
                      defaultValue={category.name}
                      maxLength={20}
                      required
                      aria-label={`${category.name} 이름`}
                      className="h-10 rounded-xl bg-surface-hover px-3"
                    />
                    {/* 펼친 카테고리 안이라 이름을 또 붙이지 않는다. 붙이면 목록의
                        카테고리 이름과 같은 글이 두 번 나온다. */}
                    <ColorSwatches
                      name="color"
                      legend="색"
                      defaultValue={category.color}
                    />
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
