import { headers } from "next/headers";

/** 데스크톱 앱(desktop/main.js)이 사용자 에이전트 끝에 붙이는 표시. 두 곳이 같아야 한다. */
export const DESKTOP_UA_MARK = "ModoriDesktop";

/**
 * 지금 요청이 데스크톱 앱 창에서 왔는지. 로그인 화면이 버튼을 바꾸는 데만 쓴다.
 * 사용자가 꾸밀 수 있는 값이라 권한 판단에는 쓰지 않는다.
 */
export async function isDesktopApp(): Promise<boolean> {
  return ((await headers()).get("user-agent") ?? "").includes(DESKTOP_UA_MARK);
}
