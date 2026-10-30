"use client";

import { useT } from "@/components/locale-provider";
import { SubmitButton } from "@/components/submit-button";
import { settings } from "@/lib/i18n/messages/settings";

import {
  deleteAccount,
  type DeleteAccountState,
} from "@/app/(tabs)/settings/account/actions";
import { useFormAction } from "@/components/use-form-action";

export function DeleteAccountForm({ nickname }: { nickname: string }) {
  const t = useT(settings);
  const [state, action, pending] = useFormAction<DeleteAccountState>(
    deleteAccount,
    null,
  );

  return (
    <form onSubmit={action} className="flex flex-col gap-4">
      <label htmlFor="confirm" className="text-sm text-muted">
        {t("deleteConfirmBefore")}<b className="text-foreground">{nickname}</b>{t("deleteConfirmAfter")}
      </label>
      <input
        id="confirm"
        name="confirm"
        required
        autoComplete="off"
        placeholder={t("nicknamePlaceholder")}
        className="h-11 rounded-xl bg-surface-hover px-3 outline-none focus:ring-2 focus:ring-red-500"
      />

      {state?.message && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}

      <SubmitButton
        pending={pending}
        pendingLabel={t("deleting")}
        className="h-11 rounded-xl bg-red-600 text-sm font-semibold text-white"
      >
        {t("deleteAccount")}
      </SubmitButton>
    </form>
  );
}
