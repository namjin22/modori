"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "오늘" },
  { href: "/calendar", label: "캘린더" },
  { href: "/feed", label: "피드" },
  { href: "/settings", label: "설정" },
] as const;

export function BottomNav({ unreadReactions }: { unreadReactions: number }) {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 border-t border-border bg-surface">
      <ul className="mx-auto flex w-full max-w-lg">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const badge = tab.href === "/feed" ? unreadReactions : 0;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-14 items-center justify-center gap-1 text-sm transition-colors ${
                  isActive
                    ? "font-semibold text-brand"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
                {badge > 0 && (
                  <span
                    aria-label={`안 읽은 반응 ${badge}개`}
                    className="rounded-full bg-brand px-1.5 py-0.5 text-xs font-semibold text-brand-contrast"
                  >
                    {badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
