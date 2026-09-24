"use client";

import { SubmitButton } from "@/components/submit-button";

import {
  deleteAccount,
  type DeleteAccountState,
} from "@/app/(tabs)/settings/account/actions";
import { useFormAction } from "@/components/use-form-action";

export function DeleteAccountForm({ nickname }: { nickname: string }) {
  const [state, action, pending] = useFormAction<DeleteAccountState>(
    deleteAccount,
    null,
  );

  return (
    <form onSubmit={action} className="flex flex-col gap-4">
      <label htmlFor="confirm" className="text-sm text-muted">
        확인을 위해 지금 닉네임 <b className="text-foreground">{nickname}</b>을(를)
        그대로 입력해주세요.
      </label>
      <input
        id="confirm"
        name="confirm"
        required
        autoComplete="off"
        placeholder="닉네임 입력"
        className="h-11 rounded-xl bg-surface-hover px-3 outline-none focus:ring-2 focus:ring-red-500"
      />

      {state?.message && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}

      <SubmitButton
        pending={pending}
        pendingLabel="지우는 중"
        className="h-11 rounded-xl bg-red-600 text-sm font-semibold text-white"
      >
        계정 지우기
      </SubmitButton>
    </form>
  );
}
