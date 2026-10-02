/** 저장하는 프로필 사진의 한 변 길이. 목록에서 40px로 쓰니 이 정도면 넉넉하다. */
export const PROFILE_IMAGE_SIZE = 128;

/**
 * 파일 헤더에 적힌 가로·세로 상한. 화면은 128px로 줄여 올리지만 서버 액션은 직접 부를 수 있어, 작은 파일에 아주 큰 그림
 * (예: 단색 60000×60000 PNG, 90KB)을 넣으면 팔로워의 브라우저가 전체 크기로 풀다가 느려지거나 죽는다.
 */
export const MAX_PROFILE_IMAGE_DIMENSION = 256;

/** data URL 길이 상한. 128×128 JPEG는 보통 10KB 안쪽이라 넉넉히 잡은 값이다. */
export const MAX_PROFILE_IMAGE_LENGTH = 120_000;

const DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/** 0이 아니고 상한 이하여야 한다. */
function withinLimit(width: number, height: number): boolean {
  return width > 0 && height > 0 && width <= MAX_PROFILE_IMAGE_DIMENSION && height <= MAX_PROFILE_IMAGE_DIMENSION;
}

function hasPngStructure(bytes: Buffer): boolean {
  if (bytes.length < 57 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  let offset = 8;
  let hasIdat = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return false;
    const chunk = bytes.toString("ascii", offset + 4, offset + 8);
    if (offset === 8 && (chunk !== "IHDR" || length !== 13 ||
      !withinLimit(bytes.readUInt32BE(offset + 8), bytes.readUInt32BE(offset + 12)))) return false;
    if (chunk === "IDAT" && length > 0) hasIdat = true;
    if (chunk === "IEND") return length === 0 && hasIdat && end === bytes.length;
    offset = end;
  }
  return false;
}

function hasJpegStructure(bytes: Buffer): boolean {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8 ||
    bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return false;
  let offset = 2;
  let hasFrame = false;
  while (offset + 4 <= bytes.length - 2) {
    if (bytes[offset++] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0 || marker === 0xd8 || marker === 0xd9 || offset + 2 > bytes.length - 2) return false;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length - 2) return false;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      hasFrame = length >= 7 && withinLimit(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3));
    }
    if (marker === 0xda) return hasFrame && length >= 6 && offset + length < bytes.length - 2;
    offset += length;
  }
  return false;
}

function hasWebpStructure(bytes: Buffer): boolean {
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.readUInt32LE(4) !== bytes.length - 8 || bytes.toString("ascii", 8, 12) !== "WEBP") return false;
  let offset = 12;
  let hasImage = false;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + size > bytes.length) return false;
    if (type === "VP8 " && size >= 10 && bytes.subarray(data + 3, data + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
      // 손실 WebP: 가로·세로는 14비트씩이다.
      if (!withinLimit(bytes.readUInt16LE(data + 6) & 0x3fff, bytes.readUInt16LE(data + 8) & 0x3fff)) return false;
      hasImage = true;
    }
    if (type === "VP8L" && size >= 5 && bytes[data] === 0x2f) {
      // 무손실 WebP: 가로-1, 세로-1을 14비트씩 담는다.
      const bits = bytes.readUInt32LE(data + 1);
      if (!withinLimit((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)) return false;
      hasImage = true;
    }
    offset = data + size + (size % 2);
  }
  return hasImage && offset === bytes.length;
}

function hasImageStructure(type: string, bytes: Buffer): boolean {
  if (type === "png") return hasPngStructure(bytes);
  if (type === "jpeg") return hasJpegStructure(bytes);
  return hasWebpStructure(bytes);
}

/**
 * data URL의 타입과 실제 이미지 파일의 기본 구조를 함께 확인한다.
 * 전체 디코딩은 하지 않으므로 이미지 데이터 자체의 무결성까지 보장하지는 않는다.
 */
export function isProfileImage(value: string): boolean {
  if (value.length > MAX_PROFILE_IMAGE_LENGTH) return false;
  const match = DATA_URL.exec(value);
  if (!match || match[2].length % 4 !== 0) return false;
  const bytes = Buffer.from(match[2], "base64");
  return bytes.toString("base64") === match[2] && hasImageStructure(match[1], bytes);
}
