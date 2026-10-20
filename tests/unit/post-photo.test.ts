import { describe, expect, it } from "vitest";

import { MAX_POST_PHOTO_LENGTH, parsePostPhoto, POST_PHOTO_MAX_DIMENSION } from "@/lib/post-photo";

// 실제 1×1 픽셀 파일의 바이트(tests/unit/profile-image.test.ts와 같은 것).
const JPEG =
  "/9j//gAPTGF2YzYzLjEuMTAyAP/bAEMACAQEBAQEBQUFBQUFBgYGBgYGBgYGBgYGBgcHBwgICAcHBwYGBwcICAgICQkJCAgICAkJCgoKDAwLCw4ODhERFP/EAE0AAQEAAAAAAAAAAAAAAAAAAAAGAQEBAQAAAAAAAAAAAAAAAAAABgcQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/wAARCAABAAEDARIAAhIAAxIA/9oADAMBAAIRAxEAPwCLEmN/H//Z";
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

const url = (base64: string, type = "jpeg") => `data:image/${type};base64,${base64}`;

/** 1×1 JPEG의 프레임 머리(SOF0)에 적힌 높이·너비를 바꾼다. */
function withSize(width: number, height: number): string {
  const bytes = Buffer.from(JPEG, "base64");
  const sof = bytes.findIndex((value, index) => value === 0xff && bytes[index + 1] === 0xc0);
  bytes.writeUInt16BE(height, sof + 5);
  bytes.writeUInt16BE(width, sof + 7);
  return bytes.toString("base64");
}

describe("parsePostPhoto", () => {
  it("JPEG를 받고 가로·세로는 파일에서 읽는다", () => {
    const photo = parsePostPhoto(url(withSize(1080, 720)));
    expect(photo).toMatchObject({ width: 1080, height: 720 });
    expect(photo?.data.length).toBeGreaterThan(100);
  });

  it("보낸 쪽이 말한 크기가 아니라 파일에 적힌 크기를 쓴다", () => {
    expect(parsePostPhoto(url(JPEG))).toMatchObject({ width: 1, height: 1 });
  });

  it("가로·세로 상한을 넘는 그림은 거절한다", () => {
    expect(parsePostPhoto(url(withSize(POST_PHOTO_MAX_DIMENSION, 100)))).not.toBeNull();
    expect(parsePostPhoto(url(withSize(POST_PHOTO_MAX_DIMENSION + 1, 100)))).toBeNull();
    expect(parsePostPhoto(url(withSize(100, 60000)))).toBeNull();
    expect(parsePostPhoto(url(withSize(0, 100)))).toBeNull();
  });

  it("JPEG가 아닌 것(PNG·글자·MIME만 JPEG인 PNG)은 거절한다", () => {
    expect(parsePostPhoto(url(PNG, "png"))).toBeNull();
    expect(parsePostPhoto(url(PNG))).toBeNull();
    expect(parsePostPhoto(url(Buffer.from("not an image").toString("base64")))).toBeNull();
  });

  it("잘린 파일, 잘못된 base64, 길이 상한 초과를 거절한다", () => {
    expect(parsePostPhoto(url(JPEG.slice(0, -4)))).toBeNull();
    expect(parsePostPhoto(url(`${JPEG}!`))).toBeNull();
    expect(parsePostPhoto(url(JPEG.slice(0, -1)))).toBeNull();
    expect(parsePostPhoto(url("A".repeat(MAX_POST_PHOTO_LENGTH)))).toBeNull();
    expect(parsePostPhoto("")).toBeNull();
    expect(parsePostPhoto("https://evil.example/a.jpg")).toBeNull();
  });
});
