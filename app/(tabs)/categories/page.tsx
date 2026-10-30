import { ColorSwatches } from "@/components/color-swatches";
import { PALETTE } from "@/lib/colors";
import { SubmitButton } from "@/components/submit-button";
import { categories as categoryMessages } from "@/lib/i18n/messages/categories";
import { getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { LIMITS } from "@/lib/limits";
import { requireUser } from "@/lib/session";

import { createCategory, reorderCategories, restoreCategory } from "./actions";
import { BackLink } from "@/components/back-link";
import { DoriMessage } from "@/components/dori-message";
import { PrivateSwitch } from "@/components/private-switch";
import { SortableList } from "@/components/sortable-list";
import { CategoryEditor } from "@/components/category-editor";

// 브랜드 파랑을 기본값으로 두면 새 카테고리가 버튼 색과 구분되지 않는다.
const DEFAULT_NEW_COLOR = PALETTE[0].value;

export default async function CategoriesPage() {
  const user = await requireUser();
  const t = await getT(categoryMessages);

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { order: "asc" },
  });

  const active = categories.filter((category) => !category.archivedAt);
  const archived = categories.filter((category) => category.archivedAt);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/" label={t("toFeed")} />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </header>

      {/* 상한에 닿으면 폼 대신 이유를 보여준다. 눌렀는데 아무 일도 없으면 고장 난 줄 안다. */}
      {active.length >= LIMITS.categories ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-muted">
          {t("limitReached", { max: LIMITS.categories })}
        </p>
      ) : (
        <form
          action={createCategory}
          className="flex flex-col gap-4 rounded-2xl bg-surface p-4"
        >
          <div className="flex gap-2">
            <input
              name="name"
              required
              maxLength={20}
              placeholder={t("newPlaceholder")}
              aria-label={t("newLabel")}
              className="h-11 min-w-0 flex-1 rounded-xl bg-surface-hover px-3"
            />
            <SubmitButton
              pendingLabel={t("adding")}
              className="h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast"
            >
              {t("add")}
            </SubmitButton>
          </div>
          <ColorSwatches
            name="color"
            legend={t("color")}
            defaultValue={DEFAULT_NEW_COLOR}
          />
          <PrivateSwitch title={t("privateTitle")} description={t("privateHint")} />
        </form>
      )}

      {active.length === 0 ? (
        <DoriMessage mood="happy">
          <p>{t("noCategories")}</p>
        </DoriMessage>
      ) : (
        // 카드를 잡고 끌어 순서를 바꾼다. 피드의 카테고리 묶음도 이 순서를 따른다.
        <SortableList
          variant="card"
          noun={t("title")}
          save={reorderCategories}
          items={active.map((category) => ({
            id: category.id,
            label: category.name,
            node: <CategoryEditor category={category} />,
          }))}
        />
      )}

      {archived.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">{t("archiveTitle")}</h2>
          <p className="text-xs text-muted">{t("archiveHint")}</p>
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
                    {t("restore")}
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
