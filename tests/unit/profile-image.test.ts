import { describe, expect, it } from "vitest";

import { isProfileImage, MAX_PROFILE_IMAGE_DIMENSION, MAX_PROFILE_IMAGE_LENGTH } from "@/lib/profile-image";

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

describe("isProfileImage 픽셀 크기", () => {
  it("상한(256px) 이하의 큰 그림은 받고, 넘으면 파일이 작아도 거절한다", () => {
    const png = Buffer.from(images.png, "base64");
    // IHDR 가로·세로(16~23번째 바이트)를 바꾼다. 파서는 CRC를 보지 않는다.
    png.writeUInt32BE(MAX_PROFILE_IMAGE_DIMENSION, 16);
    png.writeUInt32BE(MAX_PROFILE_IMAGE_DIMENSION, 20);
    expect(isProfileImage(dataUrl("png", png.toString("base64")))).toBe(true);

    png.writeUInt32BE(60000, 16);
    png.writeUInt32BE(60000, 20);
    expect(isProfileImage(dataUrl("png", png.toString("base64")))).toBe(false);
    png.writeUInt32BE(MAX_PROFILE_IMAGE_DIMENSION + 1, 16);
    png.writeUInt32BE(1, 20);
    expect(isProfileImage(dataUrl("png", png.toString("base64")))).toBe(false);
  });

  it("JPEG 프레임 헤더의 크기도 본다", () => {
    const jpeg = Buffer.from(images.jpeg, "base64");
    const sof = jpeg.indexOf(Buffer.from([0xff, 0xc0]));
    expect(sof).toBeGreaterThan(0);
    jpeg.writeUInt16BE(40000, sof + 5); // 세로
    jpeg.writeUInt16BE(40000, sof + 7); // 가로
    expect(isProfileImage(dataUrl("jpeg", jpeg.toString("base64")))).toBe(false);
  });

  it("WebP(손실)의 크기도 본다", () => {
    const webp = Buffer.from(images.webp, "base64");
    const vp8 = webp.indexOf("VP8 ");
    expect(vp8).toBeGreaterThan(0);
    const data = vp8 + 8;
    webp.writeUInt16LE(16000, data + 6);
    webp.writeUInt16LE(16000, data + 8);
    expect(isProfileImage(dataUrl("webp", webp.toString("base64")))).toBe(false);
  });
});
