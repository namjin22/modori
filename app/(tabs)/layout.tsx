import type { ReactNode } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { DesktopUpdateBanner } from "@/components/desktop-update";
import { PageFrame } from "@/components/page-frame";
import { PushRegistrar } from "@/components/push-registrar";
import { ResumeRefresh } from "@/components/resume-refresh";
import { TimezoneNudge } from "@/components/timezone-nudge";
import { TimezoneProvider } from "@/components/timezone-context";
import { ToastProvider } from "@/components/toast";
import { WebPushSync } from "@/components/web-push-sync";
import { countUnreadNotifications, requireUser } from "@/lib/session";

// 탭 화면은 전부 로그인과 닉네임이 필요하다. 각 페이지에서 반복하지 않고 여기서 막는다.
export default async function TabsLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  // 웹과 데스크톱은 뱃지로 알리고, 켠 기기는 컴퓨터 알림도 띄운다(브라우저는 웹 푸시, 데스크톱 앱은 창이 열려 있는 동안). 모바일 앱은 받은 반응·새 팔로워를 푸시로도 알린다(components/push-registrar.tsx).
  const [unreadNotifications] = await Promise.all([
    countUnreadNotifications(user.id, user.lastSeenAt, user.notifyFriendDone),
  ]);

  return (
    <ToastProvider>
      <TimezoneProvider timezone={user.timezone}>
      <PushRegistrar />
      <WebPushSync userId={user.id} />
      <ResumeRefresh />
      <div className="flex min-h-screen flex-col">
        <PageFrame>
          <DesktopUpdateBanner />
          <TimezoneNudge />
          {children}
        </PageFrame>
        <BottomNav userId={user.id} unreadNotifications={unreadNotifications} />
      </div>
      </TimezoneProvider>
    </ToastProvider>
  );
}
