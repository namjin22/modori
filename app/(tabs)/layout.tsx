import type { ReactNode } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { LocaleSync } from "@/components/locale-sync";
import { DesktopUpdateBanner, OutdatedAppBanner } from "@/components/desktop-update";
import { PageFrame } from "@/components/page-frame";
import { PushRegistrar } from "@/components/push-registrar";
import { ResumeRefresh } from "@/components/resume-refresh";
import { TimezoneNudge } from "@/components/timezone-nudge";
import { TimezoneProvider } from "@/components/timezone-context";
import { ToastProvider } from "@/components/toast";
import { WebPushSync } from "@/components/web-push-sync";
import { outdatedDesktopApp } from "@/lib/desktop";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import { getLocaleCookie } from "@/lib/i18n/server";
import { countUnreadNotifications, requireUser } from "@/lib/session";

// 탭 화면은 전부 로그인과 닉네임이 필요하다. 각 페이지에서 반복하지 않고 여기서 막는다.
export default async function TabsLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  // 앱 안 업데이트가 없는 옛 Windows 앱이면 그 버전. 새 버전은 한 번 새로 설치해야 받을 수 있다.
  const outdatedApp = await outdatedDesktopApp();

  // 웹과 데스크톱은 뱃지로 알리고, 켠 기기는 컴퓨터 알림도 띄운다(브라우저는 웹 푸시, 데스크톱 앱은 창이 열려 있는 동안). 모바일 앱은 받은 반응·새 팔로워를 푸시로도 알린다(components/push-registrar.tsx).
  const [unreadNotifications] = await Promise.all([
    countUnreadNotifications(user.id, user.lastSeenAt, user.notifyFriendDone),
  ]);

  // 이 기기에 고른 언어(없으면 한국어)와 계정의 언어가 다르면 한 번 맞춘다(components/locale-sync.tsx).
  const cookieLocale = await getLocaleCookie();
  const localeTarget = cookieLocale ?? user.locale;

  return (
    <ToastProvider>
      <TimezoneProvider timezone={user.timezone}>
      {(cookieLocale ?? DEFAULT_LOCALE) !== user.locale && isLocale(localeTarget) && <LocaleSync target={localeTarget} />}
      <PushRegistrar />
      <WebPushSync userId={user.id} />
      <ResumeRefresh />
      <div className="flex min-h-screen flex-col">
        <PageFrame>
          {outdatedApp ? <OutdatedAppBanner version={outdatedApp} /> : <DesktopUpdateBanner />}
          <TimezoneNudge />
          {children}
        </PageFrame>
        <BottomNav userId={user.id} unreadNotifications={unreadNotifications} />
      </div>
      </TimezoneProvider>
    </ToastProvider>
  );
}
