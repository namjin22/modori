"use client";

import {
  updateProfile,
  type ProfileFormState,
} from "@/app/(tabs)/settings/profile/actions";
import { AvatarChoice } from "@/components/avatar-choice";
import { useT } from "@/components/locale-provider";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/components/use-form-action";
import type { CharacterId } from "@/lib/characters";
import { common } from "@/lib/i18n/messages/common";
import { profile } from "@/lib/i18n/messages/profile";

export function ProfileForm({
  nickname,
  profileImage,
  avatarCharacter,
  bio,
}: {
  nickname: string;
  profileImage: string | null;
  avatarCharacter: CharacterId;
  bio: string;
}) {
  const t = useT(profile);
  const tc = useT(common);
  const [state, formAction, pending] = useFormAction<ProfileFormState>(
    updateProfile,
    null,
  );
  return (
    <form onSubmit={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t("nickname")}
        <input
          name="nickname"
          defaultValue={nickname}
          required
          maxLength={20}
          aria-label={t("nickname")}
          className="h-12 rounded-xl bg-surface-hover px-3 text-base text-foreground outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      <AvatarChoice defaultCharacter={avatarCharacter} defaultPhoto={profileImage} fade="surface" />

      <label className="flex flex-col gap-1 text-xs text-muted">
        {t("bio")}
        <input
          name="bio"
          defaultValue={bio}
          maxLength={100}
          placeholder={t("bioPlaceholder")}
          aria-label={t("bioLabel")}
          className="h-12 rounded-xl bg-surface-hover px-3 text-base text-foreground outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      {state && (
        <p
          role="status"
          className={`text-sm ${
            state.message === t("saved") ? "text-brand" : "text-danger"
          }`}
        >
          {state.message}
        </p>
      )}

      <SubmitButton
        pending={pending}
        pendingLabel={tc("saving")}
        className="h-12 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
      >
        {tc("save")}
      </SubmitButton>
    </form>
  );
}
