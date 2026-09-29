import type { Metadata } from "next";

import { BackLink } from "@/components/back-link";
import { TermsOfService } from "@/components/terms-of-service";

export const metadata: Metadata = { title: "이용약관 · 모도리" };

// 개인정보처리방침처럼 로그인하지 않아도 볼 수 있다.
export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 pb-16 pt-8 md:max-w-2xl">
      <header className="flex items-center gap-1">
        <BackLink href="/" label="돌아가기" />
        <h1 className="text-2xl font-bold">이용약관</h1>
      </header>
      <TermsOfService />
    </main>
  );
}
