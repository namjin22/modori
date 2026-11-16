import type { Metadata } from "next";

import { Tutorial } from "@/components/tutorial";
import { ToastProvider } from "@/components/toast";
import { tutorial } from "@/lib/i18n/messages/tutorial";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(tutorial))("pageTitle") };
}

/**
 * 처음 쓰는 사람용 사용법 카드(2026-11-16). 가입 뒤 처음 홈을 열 때 홈이 여기로 보낸다(app/(tabs)/page.tsx).
 * 설정의 "사용법 다시 보기"(?replay=1)로도 언제든 연다. 하단 탭이 없는 전체 화면이다.
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ replay?: string }> }) {
  await requireUser();
  const replay = (await searchParams).replay === "1";

  return (
    <ToastProvider>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-8 pt-6">
        <Tutorial replay={replay} />
      </main>
    </ToastProvider>
  );
}
