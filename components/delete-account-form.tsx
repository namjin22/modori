"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/submit-button";

import {
  deleteAccount,
  type DeleteAccountState,
} from "@/app/(tabs)/settings/account/actions";

export function DeleteAccountForm({ nickname }: { nickname: string }) {
  const [state, action] = useActionState<DeleteAccountState, FormData>(
    deleteAccount,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
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
        <p role="alert" className="text-sm text-red-500">
          {state.message}
        </p>
      )}

      <SubmitButton
        pendingLabel="지우는 중"
        className="h-11 rounded-xl bg-red-500 text-sm font-semibold text-white"
      >
        계정 지우기
      </SubmitButton>
    </form>
  );
}
