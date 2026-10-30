"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useT } from "@/components/locale-provider";
import { settings } from "@/lib/i18n/messages/settings";

/**
 * 친구 추천을 새로 뽑는다. 주소의 r 값(무작위 글자)을 바꿔 서버가 다른 세 명을 고르게 한다.
 * 같은 주소는 브라우저가 5분 동안 기억하므로(next.config.ts staleTimes), 누를 때마다 새 값을 붙인다.
 */
export function ShuffleButton({ path = "/feed/search" }: { path?: string }) {
  const router = useRouter();
  const t = useT(settings);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.replace(`${path}?r=${Math.random().toString(36).slice(2, 8)}`))}
      className="h-8 rounded-full bg-surface-hover px-3 text-xs font-medium text-muted transition-colors hover:text-foreground active:scale-95 disabled:opacity-60"
    >
      {pending ? t("shuffling") : t("shuffle")}
    </button>
  );
}
