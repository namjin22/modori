"use client";

import { useRef, useState } from "react";

import { MAX_POST_PHOTO_LENGTH, POST_PHOTO_MAX_EDGE } from "@/lib/post-photo";

/** 긴 변을 maxEdge 이하로 줄여 JPEG data URL로 만든다. 다시 그리는 과정에서 사진 속 위치(GPS)·촬영 기기 정보가 사라진다. */
async function toPostPhotoDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    // 크기가 상한을 넘으면 화질을 낮추고, 그래도 크면 변을 더 줄여 다시 시도한다.
    for (const [edge, quality] of [
      [POST_PHOTO_MAX_EDGE, 0.82],
      [POST_PHOTO_MAX_EDGE, 0.65],
      [800, 0.7],
      [640, 0.6],
    ] as const) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("캔버스를 만들지 못했다.");
      // JPEG는 투명을 담지 못해 투명한 곳이 검게 저장된다. 흰 바탕을 먼저 깐다.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/jpeg", quality);
      if (url.length <= MAX_POST_PHOTO_LENGTH) return url;
    }
    throw new Error("사진이 너무 커요.");
  } finally {
    bitmap.close();
  }
}

/**
 * 피드 글에 사진 한 장 붙이기. 고른 사진은 브라우저에서 줄여 숨은 칸(photo)에 담아 폼과 함께 보낸다.
 * 줄이는 동안에는 photoBusy를 같이 보내 서버가 사진이 빠진 채 올라가는 것을 막는다(프로필 사진과 같은 방식).
 */
export function PostPhotoField({ photo, onChange }: { photo: string; onChange: (photo: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function pick(file: File) {
    setProblem("");
    setBusy(true);
    try {
      onChange(await toPostPhotoDataUrl(file));
    } catch (error) {
      console.warn("[post] 사진을 줄이지 못했다.", error instanceof Error ? error.message : error);
      setProblem("이 사진은 쓸 수 없어요. 다른 사진으로 해 보세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="피드 사진 파일"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pick(file);
          // 같은 파일을 다시 골라도 change가 오게 비운다.
          event.target.value = "";
        }}
        className="sr-only"
        tabIndex={-1}
      />
      <input type="hidden" name="photo" value={photo} />
      {busy && <input type="hidden" name="photoBusy" value="1" />}

      {photo ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="올릴 사진 미리보기" className="max-h-48 max-w-full rounded-xl" />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="사진 빼기"
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="flex h-10 w-fit items-center gap-2 rounded-xl bg-surface-hover px-4 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-60"
        >
          <span aria-hidden>🖼️</span>
          {busy ? "줄이는 중" : "사진 붙이기"}
        </button>
      )}
      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
    </div>
  );
}
