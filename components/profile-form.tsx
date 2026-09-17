"use client";

import { useActionState, useState } from "react";

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
  // 고른 이모지를 버튼에도 표시하려면 입력칸 값을 상태로 들고 있어야 한다.
  const [emoji, setEmoji] = useState(profileEmoji);

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
          value={emoji}
          onChange={(event) => setEmoji(event.target.value)}
          required
          maxLength={8}
          aria-label="프로필 이모지"
          className="h-12 w-20 rounded-xl bg-surface-hover px-3 text-center text-2xl outline-none focus:ring-2 focus:ring-brand"
        />
        {/* 여덟 개가 한 줄에 들어가게 칸을 나눈다. 줄이 넘어가면 하나만 떨어져 어색하다. */}
        <div className="grid grid-cols-8 gap-1">
          {SUGGESTED_EMOJIS.map((suggested) => (
            <button
              key={suggested}
              type="button"
              aria-label={`${suggested} 고르기`}
              aria-pressed={emoji === suggested}
              onClick={() => setEmoji(suggested)}
              className={`flex aspect-square items-center justify-center rounded-xl text-xl ${
                emoji === suggested
                  ? "bg-brand-subtle ring-2 ring-brand"
                  : "bg-surface-hover"
              }`}
            >
              {suggested}
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
