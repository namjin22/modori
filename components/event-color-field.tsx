"use client";

import Link from "next/link";
import { useState } from "react";

import { ColorSwatches } from "@/components/color-swatches";
import { useEventCategories } from "@/components/event-categories";
import { useT } from "@/components/locale-provider";
import { events } from "@/lib/i18n/messages/events";

/**
 * 일정의 색 칸. 이름 붙은 색(일정 카테고리, 2026-11-25)이 하나도 없으면 예전처럼 색 견본만 보인다.
 * 있으면 그 이름들을 칩으로 먼저 보이고, 하나를 고르면 그 카테고리의 색이 일정의 색이 된다(견본은 숨는다).
 * "직접 고르기"를 고르면 견본에서 색을 직접 고른다(그러면 카테고리는 붙지 않는다).
 * 폼에는 categoryId와 color가 숨은 칸이나 견본 라디오로 같이 간다. 서버가 카테고리를 확인하고 그 색을 쓴다(app/(tabs)/events/actions.ts).
 */
export function EventColorField({ defaultCategoryId, defaultColor }: { defaultCategoryId: string | null; defaultColor: string }) {
  const t = useT(events);
  const categories = useEventCategories();
  const [categoryId, setCategoryId] = useState<string | null>(
    defaultCategoryId && categories.some((category) => category.id === defaultCategoryId) ? defaultCategoryId : null,
  );
  // 견본이 다시 그려질 때 시작할 색. 카테고리를 눌렀다가 "직접 고르기"로 돌아오면 그 색에서 이어 고른다.
  const [seed, setSeed] = useState(defaultColor);

  if (categories.length === 0) return <ColorSwatches name="color" legend={t("color")} defaultValue={defaultColor} />;

  const picked = categories.find((category) => category.id === categoryId) ?? null;
  const chip = "flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-medium";

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-2 text-xs text-muted">{t("categoryLegend")}</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={category.id === categoryId}
              onClick={() => {
                setCategoryId(category.id);
                setSeed(category.color);
              }}
              className={`${chip} ${category.id === categoryId ? "border-foreground bg-surface-hover" : "border-border"}`}
            >
              <span aria-hidden className="color-edge size-3.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="max-w-40 truncate">{category.name}</span>
            </button>
          ))}
          <button
            type="button"
            aria-pressed={picked === null}
            onClick={() => setCategoryId(null)}
            className={`${chip} ${picked === null ? "border-foreground bg-surface-hover" : "border-border text-muted"}`}
          >
            {t("categoryCustom")}
          </button>
        </div>
        <Link prefetch={false} href="/event-categories" className="mt-1 self-end text-xs font-medium text-brand">
          {t("categoryManage")}
        </Link>
      </fieldset>

      {picked ? (
        <>
          <input type="hidden" name="categoryId" value={picked.id} />
          <input type="hidden" name="color" value={picked.color} />
        </>
      ) : (
        <ColorSwatches name="color" legend={t("color")} defaultValue={seed} />
      )}
    </div>
  );
}
