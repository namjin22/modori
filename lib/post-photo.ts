import { jpegSize } from "@/lib/profile-image";

/**
 * 공개 피드 글에 붙이는 사진(2026-10-20). 브라우저가 긴 변 1080px 이하 JPEG로 다시 그려 보낸다(components/post-photo-field.tsx).
 * 서버는 그 약속을 믿지 않고 다시 검사한다: JPEG 구조, 가로·세로 상한, 크기 상한. 크기(가로·세로)도 서버가 파일에서 직접 읽는다.
 * 서버 액션 본문 상한이 1MB라(Next 기본값) 사진 data URL은 그 안에 들어와야 한다.
 */
export const POST_PHOTO_MAX_EDGE = 1080;
/** 파일 헤더의 가로·세로 상한. 화면은 1080으로 줄이지만 서버 액션은 직접 부를 수 있어, 아주 큰 그림으로 남의 브라우저를 느리게 하지 못하게 한다. */
export const POST_PHOTO_MAX_DIMENSION = 1280;
/** data URL 길이 상한(글자 수). 1080px JPEG는 대개 100~250KB(base64로 135~330KB)다. */
export const MAX_POST_PHOTO_LENGTH = 500_000;
/** 사진을 붙인 글은 하루(최근 24시간)에 이만큼만. 사진은 용량을 많이 먹어서 글보다 더 아낀다. */
export const PHOTO_POSTS_PER_DAY = 3;

const DATA_URL = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/;

export type PostPhotoData = { data: Uint8Array<ArrayBuffer>; width: number; height: number };

/** 사진 data URL을 검사해 저장할 값으로 바꾼다. 맞지 않으면 null. */
export function parsePostPhoto(value: string): PostPhotoData | null {
  if (value.length > MAX_POST_PHOTO_LENGTH) return null;
  const match = DATA_URL.exec(value);
  if (!match || match[1].length % 4 !== 0) return null;
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.toString("base64") !== match[1]) return null;
  const size = jpegSize(bytes, POST_PHOTO_MAX_DIMENSION);
  if (!size) return null;
  return { data: new Uint8Array(bytes), ...size };
}
