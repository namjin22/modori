"use client";

import {
  saveNickname,
  type OnboardingState,
} from "@/app/onboarding/actions";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/components/use-form-action";

export function OnboardingForm() {
  const [state, formAction, pending] = useFormAction<OnboardingState>(
    saveNickname,
    null,
  );

  return (
    <form onSubmit={formAction} className="flex flex-col gap-4">
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
        pending={pending}
        pendingLabel="확인 중"
        className="h-14 rounded-2xl bg-brand text-base font-semibold text-brand-contrast"
      >
        시작하기
      </SubmitButton>
    </form>
  );
}
