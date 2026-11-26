import { BackLink } from "@/components/back-link";
import { DoriMessage } from "@/components/dori-message";
import { EventCategoryEditor } from "@/components/event-category-editor";
import { SortableList } from "@/components/sortable-list";
import { events as eventMessages } from "@/lib/i18n/messages/events";
import { getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { reorderEventCategories } from "./actions";

/**
 * "내 색"(이름 붙은 색)을 고치고 지우는 화면. 만드는 곳은 여기가 아니라 색 고르기의 + 다(2026-11-26 운영자 요청).
 * 할 일 카테고리 화면(/categories)에서 들어온다.
 */
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

      {categories.length === 0 ? (
        <DoriMessage mood="happy">
          <p>{t("ecEmpty")}</p>
        </DoriMessage>
      ) : (
        // 카드를 잡고 끌어 순서를 바꾼다. 색 고르기의 칸도 이 순서로 놓인다.
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
