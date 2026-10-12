"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

import { IntentLink } from "@/components/intent-link";
import { formatKST, parseKSTDate } from "@/lib/date";

/** 주소의 date를 읽는다. 손으로 고쳐 잘못됐으면 서버처럼 오늘로 본다. */
function readDateKey(raw: string | null, today: string): string {
  if (!raw) return today;
  try {
    return formatKST(parseKSTDate(raw));
  } catch (error) {
    console.error("[month-day] 날짜 형식이 잘못됐다.", error);
    return today;
  }
}

/** 새 탭으로 여는 클릭(Ctrl·가운데 버튼)은 원래 링크대로 둔다. */
export const isModifiedClick = (event: MouseEvent) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

/**
 * 한 달치를 받아 둔 화면(홈, 친구 화면)에서 고른 날을 다룬다. 고른 날은 주소의 date가 정하고, 받아 둔 기간 안에서는
 * history.pushState로 주소만 바꾼다(Next가 useSearchParams와 맞춰 주고, 뒤로 가기도 된다). 기간 밖이면 서버로 간다.
 */
export function useMonthDay({
  basePath,
  today,
  initialDate,
  month,
  from,
  to,
}: {
  basePath: string;
  today: string;
  // 서버가 그린 날. 주소의 날짜가 받아 둔 기간 밖일 때(잠깐) 대신 보인다.
  initialDate: string;
  month: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const rawDate = useSearchParams().get("date");
  const urlKey = readDateKey(rawDate, today);
  const inWindow = (key: string) => key >= from && key <= to;
  const selected = inWindow(urlKey) ? urlKey : initialDate;

  // 날짜를 고른 주소에는 늘 date를 붙인다. 보고 있던 달이 고른 날의 달과 다르면 달은 그대로 둔다.
  const hrefFor = (key: string) =>
    key.slice(0, 7) === month ? `${basePath}?date=${key}` : `${basePath}?date=${key}&month=${month}`;

  const select = (key: string, href = hrefFor(key)) => {
    if (href === window.location.pathname + window.location.search) return;
    if (inWindow(key)) window.history.pushState(null, "", href);
    else router.push(href);
  };

  return { selected, hasDateParam: rawDate !== null, inWindow, hrefFor, select };
}

/** 앞뒤 날 화살표. 받아 둔 기간 안이면 서버에 가지 않고, 밖이면(달이 바뀜) 손이 닿는 순간 미리 받는다. */
export function DayNavLink({
  href,
  onSelect,
  label,
  children,
}: {
  href: string;
  onSelect?: () => void;
  label: string;
  children: ReactNode;
}) {
  const className = "relative flex size-9 items-center justify-center rounded-full text-lg text-muted hover:bg-surface-hover";
  if (!onSelect) {
    return (
      <IntentLink href={href} aria-label={label} className={className}>
        {children}
      </IntentLink>
    );
  }
  return (
    <Link
      prefetch={false}
      href={href}
      aria-label={label}
      className={className}
      onClick={(event) => {
        if (isModifiedClick(event)) return;
        event.preventDefault();
        onSelect();
      }}
    >
      {children}
    </Link>
  );
}
