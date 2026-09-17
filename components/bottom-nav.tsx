"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CalendarIcon,
  FeedIcon,
  SettingsIcon,
  TodayIcon,
} from "@/components/tab-icons";

const TABS = [
  { href: "/", label: "오늘", Icon: TodayIcon },
  { href: "/calendar", label: "캘린더", Icon: CalendarIcon },
  { href: "/feed", label: "피드", Icon: FeedIcon },
  { href: "/settings", label: "설정", Icon: SettingsIcon },
] as const;

export function BottomNav({ unreadReactions }: { unreadReactions: number }) {
  const pathname = usePathname();

  return (
    // 홈 화면에 추가해서 전체 화면으로 열면 아이폰 아래 막대가 탭을 가린다.
    // env(safe-area-inset-bottom)만큼 아래를 더 띄운다.
    <nav className="sticky bottom-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0px)]">
      <ul className="mx-auto flex w-full max-w-lg">
        {TABS.map(({ href, label, Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          // 받은 반응 화면을 보는 중이면 이미 읽고 있는 것이다. 뱃지를 띄우지 않는다.
          const badge =
            href === "/feed" && pathname !== "/feed/reactions"
              ? unreadReactions
              : 0;

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                  isActive ? "text-brand" : "text-muted hover:text-foreground"
                }`}
              >
                <span className="relative">
                  <Icon active={isActive} />
                  {badge > 0 && (
                    <span
                      aria-label={`안 읽은 반응 ${badge}개`}
                      className="absolute -right-2 -top-1 min-w-4 rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-brand-contrast"
                    >
                      {badge}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[11px] ${isActive ? "font-semibold" : ""}`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
