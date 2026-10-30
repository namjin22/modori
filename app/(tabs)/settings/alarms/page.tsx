import type { Metadata } from "next";

import { AlarmList } from "@/components/alarm-list";
import { BackLink } from "@/components/back-link";
import { settings } from "@/lib/i18n/messages/settings";
import { getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(settings))("alarmsPageTitle") };
}

/** 내가 정한 알림(2026-10-26 요청): 정한 시각·요일에 내가 쓴 문구가 푸시로 온다. 받을 기기가 없으면 그것부터 알린다. */
export default async function AlarmsPage() {
  const user = await requireUser();
  const t = await getT(settings);
  const [alarms, tokens, subscriptions] = await Promise.all([
    prisma.alarm.findMany({
      where: { userId: user.id },
      orderBy: [{ minute: "asc" }, { createdAt: "asc" }],
      select: { id: true, minute: true, weekdays: true, message: true, enabled: true },
    }),
    // 앱 푸시 번호나 웹 푸시 구독이 하나라도 있어야 받을 수 있다.
    prisma.pushToken.count({ where: { userId: user.id } }),
    prisma.webPushSubscription.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/settings" label={t("toMyPage")} />
        <h1 className="text-2xl font-bold">{t("myAlarms")}</h1>
      </header>
      <p className="text-sm leading-relaxed text-muted">{t("alarmsIntro")}</p>
      <AlarmList alarms={alarms} hasDevice={tokens + subscriptions > 0} />
    </div>
  );
}
