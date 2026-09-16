"use client";

import { useActionState } from "react";

import {
  updateProfile,
  type ProfileFormState,
} from "@/app/(tabs)/settings/profile/actions";
import { SubmitButton } from "@/components/submit-button";

// 자주 쓰는 것만 고르기 쉽게 둔다. 직접 입력도 된다.
const SUGGESTED_EMOJIS = ["☁️", "🌱", "🔥", "⭐", "🐣", "🍀", "🌙", "🎧"];

export function ProfileForm({
  nickname,
  profileEmoji,
  bio,
}: {
  nickname: string;
  profileEmoji: string;
  bio: string;
}) {
  const [state, formAction] = useActionState<ProfileFormState, FormData>(
    updateProfile,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-xs text-muted">
        닉네임
        <input
          name="nickname"
          defaultValue={nickname}
          required
          maxLength={20}
          aria-label="닉네임"
          className="h-12 rounded-xl bg-surface-hover px-3 text-base text-foreground outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs text-muted">프로필 이모지</legend>
        <input
          name="profileEmoji"
          defaultValue={profileEmoji}
          required
          maxLength={8}
          aria-label="프로필 이모지"
          className="h-12 w-20 rounded-xl bg-surface-hover px-3 text-center text-2xl outline-none focus:ring-2 focus:ring-brand"
        />
        <div className="flex flex-wrap gap-1">
          {SUGGESTED_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`${emoji} 고르기`}
              onClick={(event) => {
                const form = event.currentTarget.form;
                const input = form?.elements.namedItem("profileEmoji");
                if (input instanceof HTMLInputElement) input.value = emoji;
              }}
              className="size-10 rounded-xl bg-surface-hover text-xl"
            >
              {emoji}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-xs text-muted">
        소개 (선택)
        <input
          name="bio"
          defaultValue={bio}
          maxLength={100}
          placeholder="한 줄로 소개해보세요"
          aria-label="소개"
          className="h-12 rounded-xl bg-surface-hover px-3 text-base text-foreground outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      {state && (
        <p
          role="status"
          className={`text-sm ${
            state.message === "저장했어요." ? "text-brand" : "text-red-500"
          }`}
        >
          {state.message}
        </p>
      )}

      <SubmitButton
        pendingLabel="저장 중"
        className="h-12 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
      >
        저장
      </SubmitButton>
    </form>
  );
}
