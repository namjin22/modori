import Link from "next/link";

import { BackLink } from "@/components/back-link";
import { DesktopDownload } from "@/components/desktop-download";
import { DesktopNotifySwitch } from "@/components/desktop-notify-switch";
import { DesktopUpdateRow, OutdatedAppNotice } from "@/components/desktop-update";
import { EventDigestSetting } from "@/components/event-digest-setting";
import { FriendDoneSwitch } from "@/components/friend-done-switch";
import { LanguageSelect } from "@/components/language-select";
import { MacAppGuide } from "@/components/mac-app-guide";
import { RecommendSwitch } from "@/components/recommend-switch";
import { ThemeToggle } from "@/components/theme-toggle";
import { TimezoneSelect } from "@/components/timezone-select";
import { dateIn, weekdayKST } from "@/lib/date";
import { isDesktopApp, isMobileApp, isWindowsBrowser, outdatedDesktopApp } from "@/lib/desktop";
import { formatMonthDay, weekdayName } from "@/lib/i18n/format";
import { language } from "@/lib/i18n/messages/language";
import { settings } from "@/lib/i18n/messages/settings";
import { timezoneNames } from "@/lib/i18n/messages/timezones";
import { getLocale, getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { timezoneOrDefault } from "@/lib/timezones";

/**
 * 설정(2026-10-31 운영자 요청): 마이페이지에 한꺼번에 있던 화면·알림·친구·시간대·앱 설정을 한 페이지로 모았다.
 * 마이페이지는 프로필과 이 페이지로 가는 줄만 둔다(docs/decisions.md "설정을 한 페이지로").
 */
export default async function PreferencesPage() {
  const user = await requireUser();
  const t = await getT(settings);
  const tl = await getT(language);
  const locale = await getLocale();
  const mobileApp = await isMobileApp();
  const desktopApp = await isDesktopApp();
  const outdatedApp = await outdatedDesktopApp();
  const desktop = desktopApp || mobileApp;
  // 설치 파일은 Windows용이라 폰·Mac 접속자에게는 보이지 않는다.
  const windows = await isWindowsBrowser();
  const timezone = timezoneOrDefault(user.timezone);
  const todayHere = dateIn(new Date(), timezone);
  const todayLabel = `${formatMonthDay(locale, todayHere)} (${weekdayName(locale, weekdayKST(todayHere))})`;
  const zoneLabel = (timezoneNames[locale] as Record<string, string>)[timezone] ?? timezone;
  const [blockedCount, notify, devices, alarmCount] = await Promise.all([
    prisma.block.count({ where: { blockerId: user.id } }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { eventDigestMinute: true, notifyFriendDone: true } }),
    prisma.pushToken.count({ where: { userId: user.id } }),
    prisma.alarm.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="flex flex-col gap-7">
      <header className="flex items-center gap-1">
        <BackLink href="/settings" label={t("toMyPage")} />
        <h1 className="text-2xl font-bold">{t("preferencesTitle")}</h1>
      </header>

      <section className="flex flex-col gap-5 rounded-2xl bg-surface p-6">
        <h2 className="text-sm font-semibold text-muted">{t("display")}</h2>
        <ThemeToggle />
        {/* 화면 언어(2026-10-30 요청). 푸시 알림도 이 언어로 온다. */}
        <div className="flex flex-col gap-2">
          <span className="text-[15px] font-medium">{tl("title")}</span>
          <LanguageSelect />
          <span className="text-[13px] text-muted">{tl("hint")}</span>
        </div>
      </section>

      {/* 컴퓨터 알림 스위치는 알림을 띄울 수 있는 컴퓨터 브라우저·데스크톱 앱에서만 보인다(그 밖에서는 스스로 숨는다). */}
      <section className="flex flex-col gap-5 rounded-2xl bg-surface p-6">
        <h2 className="text-sm font-semibold text-muted">{t("notifications")}</h2>
        {/* 오늘 일정 알림은 앱 푸시로만 보낸다(웹 푸시로는 보내지 않는다, CLAUDE.md 규칙 7). 앱에서만 보인다. */}
        {mobileApp && <EventDigestSetting minute={notify.eventDigestMinute} hasDevice={devices > 0} />}
        <FriendDoneSwitch on={notify.notifyFriendDone} />
        {!mobileApp && <DesktopNotifySwitch userId={user.id} />}
        {/* 정한 시각·문구로 오는 푸시(2026-10-26 요청). 앱·컴퓨터 모두에서 만든다. */}
        <Link prefetch={false} href="/settings/alarms" className="-mx-2 flex items-center justify-between rounded-xl px-2 py-1 text-[15px]">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{t("myAlarms")}</span>
            <span className="text-[13px] text-muted">{t("myAlarmsHint")}</span>
          </span>
          <span className="shrink-0 text-sm text-muted">{alarmCount > 0 ? t("alarmCount", { count: alarmCount }) : t("alarmCreate")}</span>
        </Link>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl bg-surface p-6">
        <h2 className="text-sm font-semibold text-muted">{t("friendsSection")}</h2>
        <RecommendSwitch hidden={user.hideFromRecommend} />
        <Link prefetch={false} href="/settings/blocked" className="flex items-center justify-between text-[15px]">
          <span>{t("blockedUsers")}</span>
          <span className="text-sm text-muted">{t("blockedCount", { count: blockedCount })}</span>
        </Link>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl bg-surface p-6">
        <h2 className="text-sm font-semibold text-muted">{t("timezone")}</h2>
        {/* 모바일 앱은 휴대폰의 시간대를 저절로 따른다(components/timezone-nudge.tsx). 고르는 칸 대신 지금 값만 보인다. */}
        {mobileApp ? (
          <p className="text-[15px]">
            {t("todayIs", { zone: zoneLabel, date: todayLabel })}
            <span className="mt-1 block text-xs text-muted">{t("followsPhone")}</span>
          </p>
        ) : (
          <TimezoneSelect current={timezone} todayLabel={todayLabel} />
        )}
      </section>

      {/* 앱 안에서는 받을 필요가 없어 숨긴다. */}
      {!desktop && windows && <DesktopDownload />}
      {/* 맥 브라우저에서만 스스로 보인다(Dock에 추가 안내). */}
      {!desktop && <MacAppGuide />}
      {/* 데스크톱 앱 안에서만. 앱 안 업데이트가 있는 앱이면 버튼을, 옛 앱이면 새로 설치하라는 안내를 보인다. */}
      {desktopApp && (outdatedApp ? <OutdatedAppNotice version={outdatedApp} /> : <DesktopUpdateRow />)}
    </div>
  );
}
