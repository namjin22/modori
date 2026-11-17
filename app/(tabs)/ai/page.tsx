import type { Metadata } from "next";

import { AiChat } from "@/components/ai-chat";
import { BackLink } from "@/components/back-link";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import { aichat } from "@/lib/i18n/messages/aichat";
import { getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(aichat))("pageTitle") };
}

/**
 * AI 도우미(2026-11-17 운영자 결정, docs/decisions.md): 목표를 말하면 AI가 되묻고 모도리에 넣을 할 일·일정을 제안하는 대화 화면.
 * 동의를 받기 전에는 대화창이 열리지 않고, 키(GEMINI_API_KEY)가 없으면 준비 중이라고만 보인다.
 */
export default async function AiPage() {
  const user = await requireUser();
  const t = await getT(aichat);
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { aiChatConsentAt: true } });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-1">
        <BackLink href="/" label={t("toFeed")} />
        <h1 className="text-2xl font-bold">{t("heading")}</h1>
      </header>
      <AiChat consented={row?.aiChatConsentAt != null} configured={isGeminiConfigured()} />
    </div>
  );
}
