import { headers } from "next/headers";

/** 데스크톱 앱(desktop/main.js)이 사용자 에이전트 끝에 붙이는 표시. 두 곳이 같아야 한다. */
export const DESKTOP_UA_MARK = "ModoriDesktop";
/** 모바일 앱(mobile/capacitor.config.json의 android.appendUserAgent)이 붙이는 표시. 두 곳이 같아야 한다. */
export const MOBILE_UA_MARK = "ModoriMobile";

async function userAgent(): Promise<string> {
  return (await headers()).get("user-agent") ?? "";
}

/**
 * 지금 요청이 데스크톱 앱 창에서 왔는지. 로그인 화면이 버튼을 바꾸는 데만 쓴다.
 * 사용자가 꾸밀 수 있는 값이라 권한 판단에는 쓰지 않는다.
 */
export async function isDesktopApp(): Promise<boolean> {
  return (await userAgent()).includes(DESKTOP_UA_MARK);
}

/** 윈도 PC의 브라우저인지. Windows 설치 파일 안내를 폰·Mac 접속자에게 보이지 않게 하는 데만 쓴다. */
export async function isWindowsBrowser(): Promise<boolean> {
  const ua = await userAgent();
  return ua.includes("Windows NT") && !/Mobile|Android/i.test(ua);
}

/** 카카오톡·인스타그램 등 앱 안 브라우저. Google은 이런 곳에서 로그인을 막는다(403 disallowed_useragent). */
export async function isInAppBrowser(): Promise<boolean> {
  return /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|DaumApps|Line\//i.test(await userAgent());
}

/** 모바일 앱(Capacitor)에서 왔는지. 쓰임과 주의는 isDesktopApp과 같다. */
export async function isMobileApp(): Promise<boolean> {
  return (await userAgent()).includes(MOBILE_UA_MARK);
}
