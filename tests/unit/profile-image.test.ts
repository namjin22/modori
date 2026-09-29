import { describe, expect, it } from "vitest";

import { isProfileImage, MAX_PROFILE_IMAGE_LENGTH } from "@/lib/profile-image";

// 실제 1×1 픽셀 파일(PNG, JPEG, WebP)의 바이트를 사용한다.
const images = {
  png: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  jpeg: "/9j//gAPTGF2YzYzLjEuMTAyAP/bAEMACAQEBAQEBQUFBQUFBgYGBgYGBgYGBgYGBgcHBwgICAcHBwYGBwcICAgICQkJCAgICAkJCgoKDAwLCw4ODhERFP/EAE0AAQEAAAAAAAAAAAAAAAAAAAAGAQEBAQAAAAAAAAAAAAAAAAAABgcQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/wAARCAABAAEDARIAAhIAAxIA/9oADAMBAAIRAxEAPwCLEmN/H//Z",
  webp: "UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoBAAEAAgA0JaACdLoB+AADsAD+8MQL/yC5YXXI1/8gP+QH/ID/+PIAAAA=",
} as const;

function dataUrl(type: keyof typeof images, bytes: string): string {
  return `data:image/${type};base64,${bytes}`;
}

describe("isProfileImage", () => {
  it("실제 PNG, JPEG, WebP 파일을 받는다", () => {
    for (const type of Object.keys(images) as (keyof typeof images)[]) {
      expect(isProfileImage(dataUrl(type, images[type]))).toBe(true);
    }
  });

  it("허용한 MIME 타입으로 표기해도 사진이 아닌 바이트는 거절한다", () => {
    const text = Buffer.from("not an image").toString("base64");
    for (const type of Object.keys(images) as (keyof typeof images)[]) {
      expect(isProfileImage(dataUrl(type, text))).toBe(false);
    }
  });

  it("파일 바이트와 MIME 타입이 다르면 거절한다", () => {
    expect(isProfileImage(dataUrl("png", images.jpeg))).toBe(false);
    expect(isProfileImage(dataUrl("jpeg", images.webp))).toBe(false);
    expect(isProfileImage(dataUrl("webp", images.png))).toBe(false);
  });

  it("잘린 이미지와 WebP의 잘못된 RIFF 길이는 거절한다", () => {
    expect(isProfileImage(dataUrl("png", images.png.slice(0, 32)))).toBe(false);
    expect(isProfileImage(dataUrl("jpeg", images.jpeg.slice(0, -4)))).toBe(false);
    const webp = Buffer.from(images.webp, "base64");
    webp.writeUInt32LE(1, 4);
    expect(isProfileImage(dataUrl("webp", webp.toString("base64")))).toBe(false);
  });
  it("헤더와 종료 마커만 흉내 낸 파일은 이미지로 보지 않는다", () => {
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0xff, 0xd9]);
    expect(isProfileImage(dataUrl("jpeg", fakeJpeg.toString("base64")))).toBe(false);

    const fakePng = Buffer.alloc(45);
    Buffer.from(images.png, "base64").copy(fakePng, 0, 0, 24);
    fakePng.writeUInt32BE(0, 33);
    fakePng.write("IEND", 37, "ascii");
    expect(isProfileImage(dataUrl("png", fakePng.toString("base64")))).toBe(false);

    const fakeWebp = Buffer.alloc(20);
    fakeWebp.write("RIFF", 0, "ascii");
    fakeWebp.writeUInt32LE(12, 4);
    fakeWebp.write("WEBPVP8 ", 8, "ascii");
    expect(isProfileImage(dataUrl("webp", fakeWebp.toString("base64")))).toBe(false);
  });

  it("잘못된 base64와 길이 상한 초과를 거절한다", () => {
    expect(isProfileImage(dataUrl("png", images.png + "A"))).toBe(false);
    expect(isProfileImage(dataUrl("png", "AAAA="))).toBe(false);
    expect(isProfileImage(dataUrl("png", images.png + "A".repeat(MAX_PROFILE_IMAGE_LENGTH)))).toBe(false);
  });
});
