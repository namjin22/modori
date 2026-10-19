"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { FeedIcon, SettingsIcon, TodayIcon } from "@/components/tab-icons";

// 카테고리와 루틴은 할 일을 적다 손보는 화면이라 피드 탭에 속한다.
const FEED_PATHS = ["/", "/categories", "/routines", "/stats"];

const TABS = [
  {
    href: "/",
    label: "피드",
    Icon: TodayIcon,
    isActive: (path: string) => FEED_PATHS.includes(path),
  },
  {
    // 공개 피드가 열렸으면 소셜 탭은 피드(/feed/public)로 간다. 아래 BottomNav가 바꾼다.
    href: "/feed",
    label: "소셜",
    Icon: FeedIcon,
    isActive: (path: string) => path.startsWith("/feed"),
  },
  {
    href: "/settings",
    label: "마이페이지",
    Icon: SettingsIcon,
    isActive: (path: string) => path.startsWith("/settings"),
  },
] as const;

// 열어 둔 화면에서 알림 수를 다시 묻는 간격. 짧으면 서버가 바빠지고, 길면 친구 소식이 늦게 보인다.
const POLL_MS = 60 * 1000;

/**
 * 서버가 그린 알림 수를 쓰다가, 화면이 보이는 동안 1분마다(그리고 다시 볼 때) 새로 묻는다.
 * 화면을 옮기지 않으면 숫자가 그대로라 웹·데스크톱에서 친구 소식을 몰랐다(2026-10-17 요청).
 */
function useLiveUnread(fromServer: number, paused: boolean): number {
  const [live, setLive] = useState<{ base: number; count: number }>({ base: fromServer, count: fromServer });
  // 서버가 새로 그린 값이 오면 그것을 따른다(렌더 중에 맞춘다).
  if (live.base !== fromServer) setLive({ base: fromServer, count: fromServer });

  useEffect(() => {
    if (paused) return;
    let stopped = false;
    async function ask() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/notifications/unread", { cache: "no-store" });
        if (!response.ok) return;
        const { count } = (await response.json()) as { count: number };
        if (!stopped && Number.isInteger(count)) setLive((current) => ({ ...current, count }));
      } catch (error) {
        // 잠깐 끊긴 것. 다음 차례에 다시 묻는다. 뱃지는 마지막 값을 그대로 둔다.
        console.warn("[unread] 알림 수를 묻지 못했다.", error instanceof Error ? error.name : error);
      }
    }
    const timer = setInterval(ask, POLL_MS);
    document.addEventListener("visibilitychange", ask);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ask);
    };
  }, [paused]);

  return live.count;
}

export function BottomNav({
  unreadNotifications: fromServer,
  publicFeed = false,
}: {
  unreadNotifications: number;
  // 공개 피드가 열렸는지(lib/public-feed.ts). 열렸으면 소셜 탭이 피드부터 연다.
  publicFeed?: boolean;
}) {
  const pathname = usePathname();
  // 알림 화면을 보는 중이면 이미 읽고 있다. 묻지 않는다.
  const unreadNotifications = useLiveUnread(fromServer, pathname === "/feed/reactions");

  return (
    // 홈 화면에 추가해서 전체 화면으로 열면 아이폰 아래 막대가 탭을 가린다.
    // env(safe-area-inset-bottom)만큼 아래를 더 띄운다.
    <nav data-bottom-nav className="sticky bottom-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0px)]">
      <ul className="mx-auto flex w-full max-w-lg md:max-w-2xl">
        {TABS.map(({ href, label, Icon, isActive: matches }) => {
          const isActive = matches(pathname);
          // 알림 화면을 보는 중이면 이미 읽고 있는 것이다. 뱃지를 띄우지 않는다.
          const badge =
            href === "/feed" && pathname !== "/feed/reactions"
              ? unreadNotifications
              : 0;

          return (
            <li key={href} className="flex-1">
              {/* 미리 불러오기는 탭 바에만 켠다(화면 전체를 미리 받아 두어 탭을 누르면 바로 열린다). 가장 자주 오가는 세 곳이다. 다른 링크까지
                  켜 두면 화면 하나 열 때 서버가 14~21번 돌아서 VM 한 대가 먼저 지치고, 요청 속도 제한
                  (세션마다 한 번에 60)도 금방 닿는다(docs/capacity.md). */}
              <Link
                href={href === "/feed" && publicFeed ? "/feed/public" : href}
                prefetch
                aria-current={isActive ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                  isActive ? "text-brand" : "text-muted hover:text-foreground"
                }`}
              >
                {/* 탭을 옮기면 새 탭의 그림이 한 번 튄다(클래스가 붙는 순간 한 번 돈다). */}
                <span className={`relative ${isActive ? "animate-pop" : ""}`}>
                  <Icon active={isActive} />
                  {badge > 0 && (
                    <span
                      aria-label={`안 읽은 알림 ${badge}개`}
                      className="absolute -right-2 -top-1 min-w-4 animate-pop rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-brand-contrast"
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
