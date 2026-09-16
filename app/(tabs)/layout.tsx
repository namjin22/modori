import type { ReactNode } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { requireUser } from "@/lib/session";

// 탭 화면은 전부 로그인과 닉네임이 필요하다. 각 페이지에서 반복하지 않고 여기서 막는다.
export default async function TabsLayout({ children }: { children: ReactNode }) {
  await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-8 pt-6">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
