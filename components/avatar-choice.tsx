"use client";

import { useRef, useState } from "react";

import { DoriFace } from "@/components/avatar";
import { toSquareDataUrl } from "@/components/profile-image-field";
import { ScrollRow } from "@/components/scroll-row";
import { CHARACTERS, DEFAULT_CHARACTER, type CharacterId } from "@/lib/characters";

/**
 * 프로필 사진 고르기: 캐릭터 넷(도리·몽이·하루·펭이) 중 하나 또는 내 사진. 가입할 때와 마이페이지에서 같이 쓴다.
 * 캐릭터는 프로필 사진에만 쓴다. 반응에는 어느 캐릭터든 누구나 쓸 수 있다(components/reaction-bar.tsx).
 *
 * 폼에는 두 값이 실린다: profileImage(내 사진이면 data URL, 아니면 빈 값)와 avatarCharacter(고른 캐릭터).
 * 사진을 골랐다가 캐릭터로 돌아와도 직전에 고른 캐릭터가 남아 있게 둘 다 따로 쥔다.
 */
export function AvatarChoice({
  defaultCharacter = DEFAULT_CHARACTER,
  defaultPhoto = null,
  fade = "background",
}: {
  defaultCharacter?: CharacterId;
  defaultPhoto?: string | null;
  // 옆으로 넘기는 줄의 가장자리 흐림 색. 놓인 바탕과 같아야 한다(가입 화면은 화면 바탕, 프로필 수정은 카드).
  fade?: "background" | "surface";
} = {}) {
  const [character, setCharacter] = useState<CharacterId>(defaultCharacter);
  const [choice, setChoice] = useState<"photo" | "character">(defaultPhoto ? "photo" : "character");
  const [photo, setPhoto] = useState<string | null>(defaultPhoto);
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

  // 칸은 같은 폭(5rem)으로 옆으로 늘어서고 손가락으로 넘겨 본다. 세로로 쌓으면 가입 화면의 절반을 차지했다(아이폰 사용자 피드백).
  const tile = (selected: boolean) =>
    `flex w-20 shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl p-3 text-sm transition-colors ${
      selected ? "animate-pop bg-brand-subtle font-semibold text-brand ring-2 ring-brand" : "bg-surface text-muted hover:bg-surface-hover"
    }`;

  return (
    // fieldset은 기본 min-width가 내용 폭(min-content)이라, 옆으로 넘기는 칸들이 페이지 전체를 넓혔다. min-w-0으로 끊어야 칸 안에서만 넘어간다.
    <fieldset className="flex min-w-0 flex-col gap-4">
      <legend className="mb-4 px-1 text-sm font-medium">프로필 사진</legend>
      {/* 한 줄로 늘어놓고 옆으로 넘긴다. 고른 칸의 테두리가 잘리지 않게 안쪽 여백을 두고, 화면 끝까지 넘어가 보이게 좌우로 조금 넓힌다.
          칸 맞춤(snap)도 그 여백(scroll-px-2)을 기준으로 한다. 빠지면 처음부터 8px 넘어가 첫 칸 테두리가 잘렸다. */}
      <ScrollRow role="radiogroup" aria-label="프로필 사진" fade={fade} className="-mx-2 flex snap-x snap-mandatory scroll-px-2 gap-3 px-2 py-1">
        {CHARACTERS.map((item) => {
          const selected = choice === "character" && character === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setCharacter(item.id);
                setChoice("character");
              }}
              className={tile(selected)}
            >
              <DoriFace size={56} character={item.id} className="rounded-full" />
              {item.name}
            </button>
          );
        })}

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
            <img src={photo} alt="" width={56} height={56} className="size-14 rounded-full object-cover" />
          ) : (
            <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-surface-hover text-2xl">
              +
            </span>
          )}
          {busy ? "줄이는 중" : "내 사진"}
        </button>
      </ScrollRow>

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
      <input type="hidden" name="avatarCharacter" value={character} />
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
