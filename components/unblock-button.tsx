"use client";

import { useTransition } from "react";

import { unblockUser } from "@/app/(tabs)/feed/safety-actions";
import { useT } from "@/components/locale-provider";
import { useToast } from "@/components/toast";
import { useSaveFailure } from "@/components/use-save-failure";
import { social } from "@/lib/i18n/messages/social";

export function UnblockButton({ targetId, small = false }: { targetId: string; small?: boolean }) {
  const t = useT(social);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const saveFailed = useSaveFailure();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            toast({ message: (await unblockUser(targetId)).message });
          } catch (error) {
            saveFailed(error);
          }
        })
      }
      className={`rounded-full bg-surface-hover font-medium disabled:opacity-50 ${small ? "h-9 px-4 text-sm" : "h-11 px-8 text-sm"}`}
    >
      {pending ? t("working") : t("unblock")}
    </button>
  );
}
