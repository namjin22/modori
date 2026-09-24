/**
 * 프로필 사진을 가리키는 주소.
 *
 * 사진은 DB에 data URL로 들어 있다. 그대로 화면에 넣으면 사진 한 장(약 9KB)이
 * 아바타를 그리는 곳마다 HTML에 실리고, Next가 같은 값을 화면 데이터에 한 번 더
 * 싣는다. 친구 한 명의 열흘치 피드만으로 같은 사진이 스무 번, 페이지가 236KB였다.
 * 주소로 내려주면 브라우저가 한 번 받아 캐시한다.
 *
 * 주소 끝에 사진 내용에서 뽑은 짧은 값을 붙인다. 사진을 바꾸면 주소가 바뀌므로
 * 캐시를 오래 둬도 옛 사진이 남지 않는다.
 */
export function avatarUrl(user: {
  id: string;
  profileImage: string | null;
}): string | null {
  if (!user.profileImage) return null;
  return `/api/avatar/${user.id}?v=${version(user.profileImage)}`;
}

/** FNV-1a 32비트. 암호용이 아니라 사진이 바뀌었는지 가리는 용도다. */
function version(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
