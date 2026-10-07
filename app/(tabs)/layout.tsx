import type { ReactNode } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { PageFrame } from "@/components/page-frame";
import { PushRegistrar } from "@/components/push-registrar";
import { TimezoneProvider } from "@/components/timezone-context";
import { ToastProvider } from "@/components/toast";
import { countUnreadNotifications, requireUser } from "@/lib/session";

// 탭 화면은 전부 로그인과 닉네임이 필요하다. 각 페이지에서 반복하지 않고 여기서 막는다.
export default async function TabsLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  // 웹과 데스크톱은 접속했을 때 뱃지로만 알린다. 모바일 앱은 받은 반응·새 팔로워를 푸시로도 알린다(components/push-registrar.tsx).
  const unreadNotifications = await countUnreadNotifications(user.id, user.lastSeenAt);

  return (
    <ToastProvider>
      <TimezoneProvider timezone={user.timezone}>
      <PushRegistrar />
      <div className="flex min-h-screen flex-col">
        <PageFrame>{children}</PageFrame>
        <BottomNav unreadNotifications={unreadNotifications} />
      </div>
      </TimezoneProvider>
    </ToastProvider>
  );
}
