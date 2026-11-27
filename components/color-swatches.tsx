"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { createNamedColor } from "@/app/(tabs)/event-categories/actions";
import { ColorPickerSheet } from "@/components/color-picker-sheet";
import { type EventCategoryOption, useEventCategories } from "@/components/event-categories";
import { useT } from "@/components/locale-provider";
import { useSaveFailure } from "@/components/use-save-failure";
import { NO_CATEGORY_COLOR } from "@/lib/colors";
import { categories as categoryMessages } from "@/lib/i18n/messages/categories";
import { events } from "@/lib/i18n/messages/events";

const SWATCH =
  "color-edge relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-surface has-[:checked]:ring-2 has-[:checked]:ring-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand";

const RADIO = "absolute inset-0 m-0 cursor-pointer appearance-none rounded-full";

type Selected = { color: string; categoryId: string | null };

/**
 * 색 고르기(2026-11-26 운영자 요청으로 다시 만들었다). 처음부터 있는 색은 없다(11-27에 흰색 하나도 뺐다). 내가 만든 색("내 색", 이름 붙은 색)이
 * 하나씩 놓이고, 맨 오른쪽 +를 누르면 이름과 색을 정해 새 색을 만든다. 아무것도 고르지 않은 것이 "색 없음"이고(처음 상태, 고른 색을 한 번 더
 * 누르면 되돌아온다), 그때는 중립 회색(NO_CATEGORY_COLOR)으로 저장되어 회색으로 보인다. 만든 색은 저장되어 일정·반복 일정·카테고리의 색 고르기에 같이 나타난다.
 * 모두 라디오 버튼이라 폼으로 그대로 전송된다(color=#rrggbb).
 *
 * categoryField를 주면(일정·반복 일정 폼) 내 색을 골랐을 때 그 id를 그 이름의 숨은 칸으로 함께 보낸다. 서버가 내 색인지 확인하고 그 색을 쓴다.
 * 흰색이나 직접 고른 색을 고르면 id는 빈 값이다. 일반 카테고리 폼은 id 없이 색만 보낸다(색을 복사해 쓴다).
 *
 * 내 색이 아닌 색(예전 여덟 색이나 흰색, 예전에 고른 색)을 이미 가진 카테고리·일정은 그 색이 한 칸으로 같이 보인다. 안 그러면 아무것도 고르지 않은 상태가 되어
 * 저장이 조용히 무시된다.
 *
 * plain이면 내 색 없이 "색 고르기" 창(100색·직접 찍기·색상 코드)만 쓴다. 내 색 자신의 색을 바꾸는 창이 쓴다.
 */
export function ColorSwatches({
  name,
  defaultValue,
  legend,
  categoryField,
  defaultCategoryId = null,
  plain = false,
  onChosen,
}: {
  name: string;
  defaultValue: string;
  legend: string;
  categoryField?: string;
  defaultCategoryId?: string | null;
  plain?: boolean;
  /**
   * +로 색을 만들거나 고르고 난 뒤, 그 색이 폼에 반영된 다음에 부른다. 라디오를 눌러 바꾼 것은 폼의 change가 알려 주지만 이 경우는 글자로
   * 반영돼 알릴 신호가 없어서다. 고르는 순간 저장하는 고치기 창이 쓴다.
   */
  onChosen?: () => void;
}) {
  const t = useT(events);
  const tcat = useT(categoryMessages);
  const saved = useEventCategories();
  const saveFailed = useSaveFailure();
  // 방금 만든 색은 서버가 목록을 다시 보내기 전에도 바로 보여야 한다.
  const [added, setAdded] = useState<EventCategoryOption[]>([]);
  const mine: EventCategoryOption[] = plain ? [] : [...saved, ...added.filter((each) => !saved.some((have) => have.id === each.id))];

  const [initial] = useState<Selected>(() => ({
    color: defaultValue,
    // 지운 색의 id이면 고르지 않은 것으로 본다(색은 그대로 남는다).
    categoryId: !plain && defaultCategoryId && saved.some((each) => each.id === defaultCategoryId) ? defaultCategoryId : null,
  }));
  const [selected, setSelected] = useState<Selected>(initial);
  // 내 색도 "색 없음"도 아닌 색(예전에 고른 색이나 plain 창에서 고른 색). 그대로 보여 주지 않으면 아무것도 고르지 않은 상태가 된다.
  const [custom, setCustom] = useState<string | null>(initial.categoryId === null && defaultValue && defaultValue !== NO_CATEGORY_COLOR ? defaultValue : null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const [chosenTick, setChosenTick] = useState(0);
  const onChosenRef = useRef(onChosen);
  useEffect(() => {
    onChosenRef.current = onChosen;
  });
  useEffect(() => {
    if (chosenTick > 0) onChosenRef.current?.();
  }, [chosenTick]);

  // 폼을 비우면(만들기 뒤 입력칸을 처음으로) 색도 처음 고른 것으로 돌린다.
  useEffect(() => {
    const form = fieldsetRef.current?.form;
    if (!form) return;
    const reset = () => setSelected(initial);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [initial]);

  const selectedName = mine.find((each) => each.id === selected.categoryId)?.name ?? null;
  const NONE: Selected = { color: NO_CATEGORY_COLOR, categoryId: null };
  const isNone = selected.categoryId === null && selected.color === NO_CATEGORY_COLOR;

  function pickPlain(hex: string) {
    setPicking(false);
    if (hex !== NO_CATEGORY_COLOR) setCustom(hex);
    setSelected({ color: hex, categoryId: null });
    setChosenTick((tick) => tick + 1);
  }

  function create(hex: string, newName: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createNamedColor(newName, hex);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setAdded((list) => [...list, result.category]);
        setSelected({ color: result.category.color, categoryId: result.category.id });
        setPicking(false);
        setChosenTick((tick) => tick + 1);
      } catch (failure) {
        setError(t("ecSaveFailed"));
        saveFailed(failure);
      }
    });
  }

  return (
    <fieldset ref={fieldsetRef} className="flex flex-col gap-1.5">
      <legend className="mb-2 text-xs text-muted">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {mine.map((category) => (
          <label key={category.id} title={category.name} className={SWATCH} style={{ backgroundColor: category.color }}>
            <input
              type="radio"
              name={name}
              value={category.color}
              checked={selected.categoryId === category.id}
              onChange={() => setSelected({ color: category.color, categoryId: category.id })}
              // 고른 색을 한 번 더 누르면 고르지 않은 상태(색 없음)로 돌아간다.
              onClick={() => {
                if (selected.categoryId === category.id) setSelected(NONE);
              }}
              aria-label={category.name}
              className={RADIO}
            />
          </label>
        ))}
        {custom && (
          <label title={custom} className={SWATCH} style={{ backgroundColor: custom }}>
            <input
              type="radio"
              name={name}
              value={custom}
              checked={selected.categoryId === null && selected.color === custom}
              onChange={() => setSelected({ color: custom, categoryId: null })}
              onClick={() => {
                if (selected.categoryId === null && selected.color === custom) setSelected(NONE);
              }}
              aria-label={t("customColor", { color: custom })}
              className={RADIO}
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setPicking(true);
          }}
          aria-label={plain ? tcat("pickColor") : t("newColor")}
          title={plain ? tcat("pickColor") : t("newColor")}
          className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundImage: "conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)" }}
        >
          <span aria-hidden className="flex size-[60%] items-center justify-center rounded-full bg-surface text-foreground">
            +
          </span>
        </button>
      </div>
      {selectedName && <p className="text-xs text-muted">{selectedName}</p>}
      {/* 아무것도 고르지 않았으면 라디오가 하나도 전송되지 않으므로 중립 회색을 따로 보낸다. */}
      {isNone && <input type="hidden" name={name} value={NO_CATEGORY_COLOR} />}
      {categoryField && <input type="hidden" name={categoryField} value={selected.categoryId ?? ""} />}

      <ColorPickerSheet
        open={picking}
        initial={selected.color}
        title={plain ? tcat("pickColor") : t("newColor")}
        confirmLabel={plain ? tcat("useColor") : t("ecAdd")}
        nameField={plain ? undefined : { label: t("ecNewLabel"), placeholder: t("ecNewPlaceholder") }}
        error={error}
        pending={pending}
        onClose={() => setPicking(false)}
        onPick={(hex, newName) => (plain ? pickPlain(hex) : create(hex, newName))}
      />
    </fieldset>
  );
}
