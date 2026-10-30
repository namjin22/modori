import Link from "next/link";

import { LanguageSelect } from "@/components/language-select";
import { LogoutButton } from "@/components/logout-button";
import { EventDigestSetting } from "@/components/event-digest-setting";
import { FriendDoneSwitch } from "@/components/friend-done-switch";
import { RecommendSwitch } from "@/components/recommend-switch";
import { ThemeToggle } from "@/components/theme-toggle";
import { TimezoneSelect } from "@/components/timezone-select";
import { dateIn, weekdayKST } from "@/lib/date";
import { formatMonthDay, weekdayName } from "@/lib/i18n/format";
import { timezoneNames } from "@/lib/i18n/messages/timezones";
import { settings } from "@/lib/i18n/messages/settings";
import { language } from "@/lib/i18n/messages/language";
import { getLocale, getT } from "@/lib/i18n/server";
import { timezoneOrDefault } from "@/lib/timezones";
import { isAdmin } from "@/lib/admin";
import { isDesktopApp, isMobileApp, isWindowsBrowser, outdatedDesktopApp } from "@/lib/desktop";
import { DesktopDownload } from "@/components/desktop-download";
import { DesktopUpdateRow, OutdatedAppNotice } from "@/components/desktop-update";
import { DesktopNotifySwitch } from "@/components/desktop-notify-switch";
import { MacAppGuide } from "@/components/mac-app-guide";
import { prisma } from "@/lib/prisma";
import { PRIVACY_MANAGER } from "@/lib/privacy";
import { requireUser } from "@/lib/session";

import { Avatar } from "@/components/avatar";
import { avatarUrl } from "@/lib/avatar";

export default async function SettingsPage() {
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
  const [following, followers, blockedCount, admin, notify, devices, alarmCount] = await Promise.all([
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.block.count({ where: { blockerId: user.id } }),
    isAdmin(user.id),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { eventDigestMinute: true, notifyFriendDone: true } }),
    prisma.pushToken.count({ where: { userId: user.id } }),
    prisma.alarm.count({ where: { userId: user.id } }),
  ]);
  // 운영자에게만: 아직 처리하지 않은 신고 수. 신고는 빨리 확인해야 한다.
  const openReports = admin ? await prisma.report.count({ where: { handledAt: null } }) : 0;

  return (
    // 칸 사이·칸 안 여백을 넓혔다(2026-10-21 요청: 글자와 여백이 너무 좁아 보인다).
    <div className="flex flex-col gap-7">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <section className="flex flex-col rounded-2xl bg-surface">
        <Link
          prefetch={false}
          href="/settings/profile"
          className="flex items-center gap-4 p-6"
        >
          <Avatar src={avatarUrl(user)} size={52} />
          <p className="flex-1 text-base font-semibold">{user.nickname}</p>
          <span className="flex items-center gap-0.5 text-sm text-muted">
            {t("editProfile")}
            <svg
              aria-hidden
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 5 L16 12 L9 19" />
            </svg>
          </span>
        </Link>

        {/* 누르면 누가 있는지 목록으로 간다. */}
        <div className="grid grid-cols-2 border-t border-border">
          <Link
            prefetch={false}
            href="/feed/following"
            className="flex flex-col items-center gap-1 py-4 hover:bg-surface-hover"
          >
            <span className="text-lg font-bold">{following}</span>
            <span className="text-xs text-muted">{t("follow")}</span>
          </Link>
          <Link
            prefetch={false}
            href="/feed/followers"
            className="flex flex-col items-center gap-1 border-l border-border py-4 hover:bg-surface-hover"
          >
            <span className="text-lg font-bold">{followers}</span>
            <span className="text-xs text-muted">{t("followers")}</span>
          </Link>
        </div>
      </section>

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


      {/* 알림은 모든 화면에 둔다(2026-10-21: 웹에서는 알림 화면 안에만 있어 찾지 못했다).
          컴퓨터 알림 스위치는 알림을 띄울 수 있는 컴퓨터 브라우저·데스크톱 앱에서만 보인다(그 밖에서는 스스로 숨는다). */}
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
        <h2 className="text-sm font-semibold text-muted">{t("findFriends")}</h2>
        <RecommendSwitch hidden={user.hideFromRecommend} />
        <Link prefetch={false} href="/settings/blocked" className="flex items-center justify-between text-[15px]">
          <span>{t("blockedUsers")}</span>
          <span className="text-sm text-muted">{t("blockedCount", { count: blockedCount })}</span>
        </Link>
      </section>

      {/* 앱 안에서는 받을 필요가 없어 숨긴다. */}
      {!desktop && windows && <DesktopDownload />}
      {/* 맥 브라우저에서만 스스로 보인다(Dock에 추가 안내). */}
      {!desktop && <MacAppGuide />}
      {/* 데스크톱 앱 안에서만. 앱 안 업데이트가 있는 앱이면 버튼을, 옛 앱이면 새로 설치하라는 안내를 보인다. */}
      {desktopApp && (outdatedApp ? <OutdatedAppNotice version={outdatedApp} /> : <DesktopUpdateRow />)}

      {/* 시간대는 자주 바꾸지 않아 로그아웃 바로 위에 둔다(2026-10-15 요청). */}
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

      <LogoutButton />

      {/* 바닥글. 자주 누를 곳이 아니라 작게 한 곳에 모은다. 계정 지우기는 실수로 누를 자리가 아니라 버튼으로 두지 않는다. */}
      <footer className="mt-6 flex flex-col items-center gap-3 border-t border-border pt-6 text-[13px] text-muted">
        <nav aria-label={t("accountNavLabel")} className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <FooterLink href="/privacy">{t("privacyPolicy")}</FooterLink>
          <Dot />
          <FooterLink href="/terms">{t("terms")}</FooterLink>
          <Dot />
          <FooterLink href="/settings/account">{t("deleteAccount")}</FooterLink>
          {/* 운영자에게만 보인다. */}
          {admin && (
            <>
              <Dot />
              <FooterLink href="/admin/errors">오류 기록</FooterLink>
              <Dot />
              <FooterLink href="/admin/metrics">지표</FooterLink>
              <Dot />
              <FooterLink href="/admin/users">사용자</FooterLink>
              <Dot />
              <FooterLink href="/admin/reports">{openReports > 0 ? `신고 ${openReports}` : "신고"}</FooterLink>
            </>
          )}
        </nav>
        {/* 출시 초기에 불편한 점과 버그를 모은다. */}
        {/* 문구와 주소 사이를 확실히 띄운다. 좁으면 주소가 다음 줄로 간다. */}
        <p className="flex flex-wrap items-center justify-center gap-x-2">
          <span>{t("feedback")}</span>
          <a
            href={`mailto:${PRIVACY_MANAGER.email}?subject=${encodeURIComponent(t("feedbackSubject"))}`}
            className="py-1 font-medium text-foreground/70 hover:text-foreground hover:underline hover:underline-offset-4"
          >
            {PRIVACY_MANAGER.email}
          </a>
        </p>
      </footer>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  // 탭 밖의 화면(방침·약관)은 화면을 통째로 새로 연다. 탭 화면 안에서 옮기는 요청이 아이폰 앱에서 끊겨
  // "This page couldn't load"가 떴다(아이폰 사용자 피드백).
  if (href === "/privacy" || href === "/terms") {
    return (
      <a href={href} className="py-1.5 hover:text-foreground hover:underline hover:underline-offset-4">
        {children}
      </a>
    );
  }
  return (
    <Link
      prefetch={false}
      href={href}
      className="py-1.5 hover:text-foreground hover:underline hover:underline-offset-4"
    >
      {children}
    </Link>
  );
}

/** 바닥글 링크 사이 세로 막대. 점(·)은 너무 흐려 한 줄이 한쪽으로 쏠려 보였다. */
function Dot() {
  return <span aria-hidden className="h-3 w-px bg-border" />;
}
