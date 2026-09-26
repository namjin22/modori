"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { formatKST, todayKST } from "@/lib/date";

/**
 * "오늘"을 보고 있는 화면이 자정을 넘기면 새 날짜로 다시 그린다.
 *
 * 휴대폰에서 앱을 켜 둔 채 밤을 넘기면, 아침에 다시 열어도 화면은 어제를 "오늘"로 보여주고
 * 거기에 적은 할 일은 어제 날짜로 들어간다. 화면이 다시 보일 때와 1분마다 날짜를 비교한다.
 * 특정 날짜(?date=)를 열어 둔 화면에는 붙이지 않는다. 그 날짜를 일부러 보고 있는 것이다.
 */
export function DayRollover({ day }: { day: string }) {
  const router = useRouter();

  useEffect(() => {
    function check() {
      if (formatKST(todayKST()) !== day) router.refresh();
    }
    function onVisible() {
      if (document.visibilityState === "visible") check();
    }

    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(check, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [day, router]);

  return null;
}
