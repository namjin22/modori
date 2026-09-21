/** 저장하는 프로필 사진의 한 변 길이. 목록에서 40px로 쓰니 이 정도면 넉넉하다. */
export const PROFILE_IMAGE_SIZE = 128;

/** data URL 길이 상한. 128×128 JPEG는 보통 10KB 안쪽이라 넉넉히 잡은 값이다. */
export const MAX_PROFILE_IMAGE_LENGTH = 120_000;

const DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * 브라우저에서 줄여 보낸 사진인지 확인한다. 서버는 폼을 그대로 믿을 수 없어서,
 * 형식과 길이를 다시 본다. 길이를 막지 않으면 큰 파일이 그대로 DB에 들어간다.
 */
export function isProfileImage(value: string): boolean {
  return value.length <= MAX_PROFILE_IMAGE_LENGTH && DATA_URL.test(value);
}
