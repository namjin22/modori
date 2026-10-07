"use client";

import { createContext, useContext, type ReactNode } from "react";

import { DEFAULT_TIMEZONE } from "@/lib/date";

const TimezoneContext = createContext<string>(DEFAULT_TIMEZONE);

/** 로그인한 사람이 고른 시간대를 클라이언트 화면(날짜 고르는 창, 자정 넘김 감지)에 알린다. 탭 화면 전체를 감싼다. */
export function TimezoneProvider({ timezone, children }: { timezone: string; children: ReactNode }) {
  return <TimezoneContext.Provider value={timezone}>{children}</TimezoneContext.Provider>;
}

/** 이 사람의 시간대(IANA 이름). 감싸지 않은 곳에서는 기본(서울). */
export function useTimezone(): string {
  return useContext(TimezoneContext);
}
