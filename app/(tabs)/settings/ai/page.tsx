import type { Metadata } from "next";

import { AiHelp } from "@/components/ai-guide";
import { ApiTokenManager } from "@/components/api-token-manager";
import { BackLink } from "@/components/back-link";
import { isTokenUsable } from "@/lib/api-token";
import { dateIn, formatKST } from "@/lib/date";
import { ai } from "@/lib/i18n/messages/ai";
import { settings } from "@/lib/i18n/messages/settings";
import { getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(ai))("pageTitle") };
}

/** AI 연결(2026-11-15, docs/mcp.md): 외부 AI가 쓰는 접근 토큰을 만들고 지운다. */
export default async function AiPage() {
  const user = await requireUser();
  const t = await getT(ai);
  const ts = await getT(settings);
  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, scope: true, allowFriends: true, hint: true, expiresAt: true, lastUsedAt: true },
  });
  // 날짜는 내 시간대의 달력으로 적는다(CLAUDE.md 규칙 2).
  const day = (instant: Date) => formatKST(dateIn(instant, user.timezone));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/settings/preferences" label={ts("toSettings")} />
        <h1 className="text-2xl font-bold">{t("heading")}</h1>
      </header>
      <p className="text-sm leading-relaxed text-muted">{t("introShort")}</p>
      <ApiTokenManager
        tokens={tokens.map((token) => ({
          id: token.id,
          name: token.name,
          scope: token.scope,
          allowFriends: token.allowFriends,
          hint: token.hint,
          expiresOn: token.expiresAt ? day(token.expiresAt) : null,
          expired: !isTokenUsable(token),
          lastUsedOn: token.lastUsedAt ? day(token.lastUsedAt) : null,
        }))}
      />
      <AiHelp />
    </div>
  );
}
