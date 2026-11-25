"use client";

import { createContext, type ReactNode, useContext } from "react";

export type EventCategoryOption = { id: string; name: string; color: string };

const EventCategoriesContext = createContext<EventCategoryOption[]>([]);

/**
 * 내 일정 카테고리(이름 붙은 색, 2026-11-25). 홈이 한 번 받아 두고, 일정 만들기·고치기 창과 일정 카드가 읽는다.
 * 일정 칸 → 카드·창으로 여러 단계 props를 내리지 않으려고 문맥으로 둔다.
 */
export function EventCategoriesProvider({ categories, children }: { categories: EventCategoryOption[]; children: ReactNode }) {
  return <EventCategoriesContext.Provider value={categories}>{children}</EventCategoriesContext.Provider>;
}

export function useEventCategories(): EventCategoryOption[] {
  return useContext(EventCategoriesContext);
}
