"use client";

import { useState } from "react";

import { useT } from "@/components/locale-provider";
import { todos as todoMessages } from "@/lib/i18n/messages/todos";

/**
 * 메모를 팔로우한 친구에게 숨길지 정하는 한 줄짜리 작은 스위치(2026-10-20 요청: 큰 스위치 줄이 생겼다 사라지며 창이 흔들렸다).
 * 메모 칸 바로 아래에 두고, 켜져 있는지 바로 보이게 오른쪽에 지금 상태를 글로 적는다.
 * 일정 자체가 비공개면(forcedPrivate) 메모도 나만 보므로 스위치 자리에 같은 높이의 안내 글을 둔다. 줄이 사라지지 않아 창 높이가 변하지 않는다.
 * 폼에는 켜졌을 때만 `memoPrivate=on`이 실린다(서버는 이 값을 뒤집어 memoPublic에 적는다).
 */
const ROW = "flex h-8 w-full items-center justify-between gap-3 px-1 text-xs text-muted";

export function MemoPrivateToggle({
  name = "memoPrivate",
  defaultChecked = false,
  forcedPrivate = false,
}: {
  name?: string;
  defaultChecked?: boolean;
  forcedPrivate?: boolean;
}) {
  const t = useT(todoMessages);
  const [checked, setChecked] = useState(defaultChecked);

  if (forcedPrivate) {
    return <p className={ROW}>{t("eventPrivateMemo")}</p>;
  }

  return (
    <label className={`${ROW} cursor-pointer`}>
      <span className="flex items-baseline gap-2">
        <span className="font-medium text-foreground">{t("memoPrivate")}</span>
        <span>{checked ? t("onlyMe") : t("visibleToFriends")}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => setChecked(event.target.checked)}
        className="relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-border transition-colors before:absolute before:left-0.5 before:top-0.5 before:size-4 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-brand checked:before:translate-x-4"
      />
    </label>
  );
}
