"use client";

import { PROFILE_IMAGE_SIZE } from "@/lib/profile-image";

/**
 * 사진을 프로필로 쓰려고 줄인다. 고른 파일을 그대로 보내면 몇 MB가 DB로 들어가므로, 브라우저에서 정사각형으로 자르고 128×128로 줄인 뒤
 * data URL로 만들어 보낸다. 서버는 이 값을 다시 검사한다(lib/profile-image.ts).
 * 가운데를 정사각형으로 잘라 한 변 128px JPEG data URL로 만든다. */
export async function toSquareDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);

  const canvas = document.createElement("canvas");
  canvas.width = PROFILE_IMAGE_SIZE;
  canvas.height = PROFILE_IMAGE_SIZE;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("캔버스를 만들지 못했다.");

  // JPEG는 투명을 담지 못해 투명한 곳이 검게 저장된다. 로고·그림 사진이 까매지지 않게 흰 바탕을 먼저 깐다.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE);
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
