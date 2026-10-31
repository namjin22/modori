import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { settings } from "@/lib/i18n/messages/settings";
import { getT } from "@/lib/i18n/server";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { PRIVACY_MANAGER } from "@/lib/privacy";
import { requireUser } from "@/lib/session";

import { Avatar } from "@/components/avatar";
import { avatarUrl } from "@/lib/avatar";

export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getT(settings);
  const [following, followers, admin] = await Promise.all([
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    isAdmin(user.id),
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

      {/* 화면·알림·친구·시간대·앱 설정은 한 페이지로 모았다(2026-10-31 요청: 마이페이지가 너무 복잡했다). 여기에는 그리로 가는 줄만 둔다. */}
      <section className="flex flex-col rounded-2xl bg-surface">
        <Link prefetch={false} href="/settings/preferences" className="flex items-center gap-4 p-6">
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t("preferencesRow")}</span>
            <span className="text-[13px] text-muted">{t("preferencesHint")}</span>
          </span>
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
            className="shrink-0 text-muted"
          >
            <path d="M9 5 L16 12 L9 19" />
          </svg>
        </Link>
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
