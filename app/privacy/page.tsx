import type { Metadata } from "next";

import { BackLink } from "@/components/back-link";
import { PrivacyPolicy } from "@/components/privacy-policy";

export const metadata: Metadata = { title: "개인정보처리방침 · 모도리" };

// 로그인하지 않아도 볼 수 있어야 한다. 가입하기 전에 읽는 글이다.
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 pb-16 pt-8 md:max-w-2xl">
      <header className="flex items-center gap-1">
        <BackLink href="/" label="돌아가기" />
        <h1 className="text-2xl font-bold">개인정보처리방침</h1>
      </header>
      <PrivacyPolicy />
    </main>
  );
}
