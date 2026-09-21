"use client";

import { useRef, useState } from "react";

import { Avatar } from "@/components/avatar";
import { PROFILE_IMAGE_SIZE } from "@/lib/profile-image";

/**
 * 사진을 골라 프로필로 쓴다. 고른 파일을 그대로 보내면 몇 MB가 DB로 들어가므로,
 * 브라우저에서 정사각형으로 자르고 128×128로 줄인 뒤 data URL로 만들어 보낸다.
 * 서버는 이 값을 다시 검사한다(lib/profile-image.ts).
 */
export function ProfileImageField({ defaultValue }: { defaultValue: string | null }) {
  const [image, setImage] = useState(defaultValue);
  const [problem, setProblem] = useState<string | null>(null);
  // 사진을 줄이는 동안 저장을 누르면 아직 빈 값이 넘어간다. 그동안 저장을 막는다.
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(file: File) {
    setProblem(null);
    setBusy(true);
    try {
      setImage(await toSquareDataUrl(file));
    } catch (error) {
      console.error("[profile] 사진을 읽지 못했다.", error);
      setProblem("사진을 읽지 못했어요. 다른 파일로 해보세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-xs text-muted">프로필 사진</legend>

      <div className="flex items-center gap-4">
        <Avatar src={image} size={64} />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="h-10 rounded-xl bg-surface-hover px-4 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "사진 줄이는 중" : "사진 고르기"}
          </button>
          {image && (
            <button
              type="button"
              onClick={() => setImage(null)}
              className="h-10 rounded-xl px-4 text-sm text-muted"
            >
              도리로 되돌리기
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="프로필 사진"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pick(file);
          // 같은 파일을 다시 골라도 change가 오게 비운다.
          event.target.value = "";
        }}
        className="sr-only"
      />
      <input type="hidden" name="profileImage" value={image ?? ""} />

      {/* 줄이는 동안 저장 버튼을 막는다. form 안의 disabled 값은 제출에서 빠진다. */}
      {busy && <input type="hidden" name="profileImageBusy" value="1" />}

      {problem && (
        <p role="alert" className="text-sm text-red-500">
          {problem}
        </p>
      )}
    </fieldset>
  );
}

/** 가운데를 정사각형으로 잘라 한 변 128px JPEG data URL로 만든다. */
async function toSquareDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);

  const canvas = document.createElement("canvas");
  canvas.width = PROFILE_IMAGE_SIZE;
  canvas.height = PROFILE_IMAGE_SIZE;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("캔버스를 만들지 못했다.");

  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PROFILE_IMAGE_SIZE,
    PROFILE_IMAGE_SIZE,
  );
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.82);
}
