"use client";

import { useActionState } from "react";

import {
  saveNickname,
  type OnboardingState,
} from "@/app/onboarding/actions";
import { SubmitButton } from "@/components/submit-button";
import { orSaveFailure } from "@/components/use-save-failure";

export function OnboardingForm() {
  const [state, formAction] = useActionState<OnboardingState, FormData>(
    orSaveFailure(saveNickname),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        name="nickname"
        type="text"
        maxLength={20}
        required
        autoFocus
        placeholder="닉네임"
        className="h-14 rounded-2xl bg-surface px-4 text-base outline-none ring-border focus:ring-2"
      />

      {state && (
        <p role="status" className="text-sm text-danger">
          {state.message}
        </p>
      )}

      <SubmitButton
        pendingLabel="확인 중"
        className="h-14 rounded-2xl bg-brand text-base font-semibold text-brand-contrast"
      >
        시작하기
      </SubmitButton>
    </form>
  );
}
