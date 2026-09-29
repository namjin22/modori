"use client";

import { useRef, useState } from "react";

import { DoriFace } from "@/components/avatar";
import { toSquareDataUrl } from "@/components/profile-image-field";

/**
 * 가입할 때 고르는 기본 프로필 사진: 캐릭터 또는 내 사진. 나중에 마이페이지에서 바꿀 수 있다.
 *
 * 캐릭터는 지금 도리 하나다. 사진이 없으면 화면이 도리 얼굴을 그리므로 "도리"는 사진을 비워 두는 것과 같다.
 * 캐릭터가 늘면(강아지·여우·펭귄 예정) CHARACTERS에 더하고, 어느 캐릭터인지 저장할 열을 그때 만든다.
 */
const CHARACTERS = [{ key: "dori", label: "도리" }] as const;

export function AvatarChoice() {
  const [choice, setChoice] = useState<"photo" | (typeof CHARACTERS)[number]["key"]>("dori");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(file: File) {
    setProblem(null);
    setBusy(true);
    try {
      setPhoto(await toSquareDataUrl(file));
      setChoice("photo");
    } catch (error) {
      console.error("[onboarding] 사진을 읽지 못했다.", error);
      setProblem("사진을 읽지 못했어요. 다른 파일로 해보세요.");
    } finally {
      setBusy(false);
    }
  }

  const tile = (selected: boolean) =>
    `flex flex-col items-center gap-1.5 rounded-2xl p-3 text-sm transition-colors ${
      selected ? "bg-brand-subtle font-semibold text-brand ring-2 ring-brand" : "bg-surface text-muted hover:bg-surface-hover"
    }`;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 px-1 text-sm font-medium">프로필 사진</legend>
      <div role="radiogroup" aria-label="프로필 사진" className="flex gap-3">
        {CHARACTERS.map((character) => (
          <button
            key={character.key}
            type="button"
            role="radio"
            aria-checked={choice === character.key}
            onClick={() => setChoice(character.key)}
            className={tile(choice === character.key)}
          >
            <DoriFace size={64} className="rounded-full" />
            {character.label}
          </button>
        ))}

        <button
          type="button"
          role="radio"
          aria-checked={choice === "photo"}
          disabled={busy}
          // 사진이 이미 있으면 그 사진으로 고르고, 없으면 바로 파일 창을 연다.
          onClick={() => (photo ? setChoice("photo") : fileRef.current?.click())}
          className={`${tile(choice === "photo")} disabled:opacity-50`}
        >
          {photo ? (
            // 브라우저에서 줄인 data URL이라 next/image가 할 일이 없다.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" width={64} height={64} className="size-16 rounded-full object-cover" />
          ) : (
            <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-surface-hover text-2xl">
              +
            </span>
          )}
          {busy ? "줄이는 중" : "내 사진"}
        </button>
      </div>

      {photo && choice === "photo" && (
        <button type="button" onClick={() => fileRef.current?.click()} className="w-fit px-1 text-xs text-brand">
          다른 사진 고르기
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="내 사진 파일"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pick(file);
          // 같은 파일을 다시 골라도 change가 오게 비운다.
          event.target.value = "";
        }}
        className="sr-only"
        tabIndex={-1}
      />
      <input type="hidden" name="profileImage" value={choice === "photo" && photo ? photo : ""} />
      {/* 줄이는 동안 시작하기를 누르면 사진이 빠진 채 가입된다. 서버가 이 값을 보고 막는다. */}
      {busy && <input type="hidden" name="profileImageBusy" value="1" />}

      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
      <p className="px-1 text-xs text-muted">마이페이지에서 언제든 바꿀 수 있어요.</p>
    </fieldset>
  );
}
