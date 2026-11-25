import { BackLink } from "@/components/back-link";
import { DoriMessage } from "@/components/dori-message";
import { EventCategoryAdder } from "@/components/event-category-adder";
import { EventCategoryEditor } from "@/components/event-category-editor";
import { SortableList } from "@/components/sortable-list";
import { events as eventMessages } from "@/lib/i18n/messages/events";
import { getT } from "@/lib/i18n/server";
import { LIMITS } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { reorderEventCategories } from "./actions";

/** 일정에 쓰는 이름 붙은 색을 만들고 고치는 화면(2026-11-25). 할 일 카테고리 화면(/categories)에서 들어온다. */
export default async function EventCategoriesPage() {
  const user = await requireUser();
  const t = await getT(eventMessages);

  const categories = await prisma.eventCategory.findMany({
    where: { userId: user.id },
    orderBy: { order: "asc" },
    select: { id: true, name: true, color: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/categories" label={t("ecBack")} />
        <h1 className="text-2xl font-bold">{t("ecTitle")}</h1>
      </header>

      <p className="text-sm text-muted">{t("ecLead")}</p>

      {/* 상한에 닿으면 폼 대신 이유를 보여준다. 눌렀는데 아무 일도 없으면 고장 난 줄 안다. */}
      {categories.length >= LIMITS.eventCategories ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-muted">{t("ecLimit", { max: LIMITS.eventCategories })}</p>
      ) : (
        <EventCategoryAdder />
      )}

      {categories.length === 0 ? (
        <DoriMessage mood="happy">
          <p>{t("ecEmpty")}</p>
        </DoriMessage>
      ) : (
        // 카드를 잡고 끌어 순서를 바꾼다. 일정 만들기 창의 칩도 이 순서를 따른다.
        <SortableList
          variant="card"
          noun={t("ecTitle")}
          save={reorderEventCategories}
          items={categories.map((category) => ({
            id: category.id,
            label: category.name,
            node: <EventCategoryEditor category={category} />,
          }))}
        />
      )}
    </div>
  );
}
