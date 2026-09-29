"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { markNotificationsSeen } from "@/app/(tabs)/feed/actions";

/** 알림 화면이 뜨면 "여기까지 봤다"를 남긴다. 화면에는 아무것도 그리지 않는다. */
export function MarkNotificationsSeen({ renderedAt }: { renderedAt: string }) {
  const sent = useRef(false);

  useEffect(() => {
    // 개발 모드의 StrictMode는 effect를 두 번 부른다. 한 번만 보낸다.
    if (sent.current) return;
    sent.current = true;
    markNotificationsSeen(renderedAt).catch((error: unknown) => {
      // 다음에 알림 화면을 열 때 다시 남긴다. 화면을 오류로 바꿀 일은 아니다.
      console.error("[notifications] 읽은 시각을 남기지 못했다.", error);
    });
  }, [renderedAt]);

  return null;
}

/**
 * 새 알림 줄. 읽은 시각을 남기면 화면이 다시 그려지는데, 보는 동안 NEW가 사라지면 무엇이 새것이었는지 모른다.
 * 처음 받은 값을 붙잡아 두고, 다음에 화면을 새로 열 때 바뀐다.
 */
export function NotificationRow({ isNew, children }: { isNew: boolean; children: ReactNode }) {
  const [wasNew] = useState(isNew);
  return (
    <li className={`flex items-center gap-3 rounded-2xl p-4 ${wasNew ? "bg-brand-subtle" : "bg-surface"}`}>
      {children}
    </li>
  );
}

export function NewMark({ isNew }: { isNew: boolean }) {
  const [wasNew] = useState(isNew);
  return wasNew ? <span className="shrink-0 text-xs text-brand">NEW</span> : null;
}
