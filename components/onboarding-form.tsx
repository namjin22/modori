"use client";

import {
  saveNickname,
  type OnboardingState,
} from "@/app/onboarding/actions";
import { useState } from "react";

import { Modal } from "@/components/modal";
import { PrivacyPolicy } from "@/components/privacy-policy";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/components/use-form-action";

export function OnboardingForm({ next }: { next: string | null }) {
  const [state, formAction, pending] = useFormAction<OnboardingState>(
    saveNickname,
    null,
  );
  const [agreed, setAgreed] = useState(false);
  const [reading, setReading] = useState(false);

  return (
    <form onSubmit={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <input
        name="nickname"
        type="text"
        maxLength={20}
        required
        autoFocus
        placeholder="닉네임"
        className="h-14 rounded-2xl bg-surface px-4 text-base outline-none ring-border focus:ring-2"
      />

      {/* 법에 따라 동의는 가입하는 사람이 직접 체크해야 한다. 미리 체크해 두지 않는다. */}
      <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
        <input
          id="privacy-agree"
          name="agree"
          type="checkbox"
          required
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          data-invalid-message="개인정보 수집·이용에 동의해주세요"
          className="size-5 shrink-0 cursor-pointer accent-brand"
        />
        <label htmlFor="privacy-agree" className="flex-1 cursor-pointer text-sm">
          개인정보 수집·이용에 동의해요 <span className="text-muted">(필수)</span>
        </label>
        <button
          type="button"
          onClick={() => setReading(true)}
          className="h-8 shrink-0 rounded-lg px-2 text-sm text-brand underline-offset-4 hover:underline"
        >
          내용 보기
        </button>
      </div>
      {/* 만 14세 미만도 가입할 수 있다. 법에 따라 개인정보 처리에는 보호자 동의가 필요해서 먼저 알린다. */}
      <p className="-mt-1 px-1 text-xs text-muted">만 14세 미만이면 보호자의 동의를 받은 뒤 가입해 주세요.</p>

      <Modal open={reading} onClose={() => setReading(false)} title="개인정보 수집·이용 동의">
        <PrivacyPolicy />
        <button
          type="button"
          onClick={() => {
            setAgreed(true);
            setReading(false);
          }}
          className="h-12 rounded-2xl bg-brand text-base font-semibold text-brand-contrast"
        >
          동의하고 닫기
        </button>
      </Modal>

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
