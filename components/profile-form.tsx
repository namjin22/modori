"use client";

import { useActionState } from "react";

import {
  updateProfile,
  type ProfileFormState,
} from "@/app/(tabs)/settings/profile/actions";
import { ProfileImageField } from "@/components/profile-image-field";
import { SubmitButton } from "@/components/submit-button";

export function ProfileForm({
  nickname,
  profileImage,
  bio,
}: {
  nickname: string;
  profileImage: string | null;
  bio: string;
}) {
  const [state, formAction] = useActionState<ProfileFormState, FormData>(
    updateProfile,
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-5">
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

      <ProfileImageField defaultValue={profileImage} />

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
