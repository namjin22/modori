/** 공개 피드의 상한. 화면(브라우저)과 서버가 같이 쓰므로 DB 코드와 떼어 둔다(lib/public-feed.ts). */
export const MAX_POST_BODY = 300;
// 하루(최근 24시간)에 올릴 수 있는 글 수. 도배를 막는다.
export const POSTS_PER_DAY = 10;
export const POSTS_PAGE = 30;
