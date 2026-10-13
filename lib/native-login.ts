/**
 * 모바일 앱 로그인 넘겨받기의 브라우저 쪽 계산. 데스크톱 앱(desktop/main.js)과 같은 방식이다(PKCE, lib/desktop-login.ts).
 * verifier는 앱 안 저장소에만 두고, 서버에는 그 해시(challenge)만 보낸다.
 */
export const VERIFIER_KEY = "modori-login-verifier";

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 새 verifier와 그 SHA-256(base64url). */
export async function createVerifier(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

/** modori://login?code=… 에서 코드를 꺼낸다. 다른 주소면 null. */
export function codeFromLink(url: string): string | null {
  let link: URL;
  try {
    link = new URL(url);
  } catch (error) {
    console.warn("[native-login] 알 수 없는 주소", url, error instanceof Error ? error.name : error);
    return null;
  }
  if (link.protocol !== "modori:" || link.hostname !== "login") return null;
  return link.searchParams.get("code");
}

/** Capacitor가 웹 화면에 넣어 주는 다리. 앱 밖(일반 브라우저)에는 없다. */
export type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    Browser?: { open: (options: { url: string }) => Promise<void>; close?: () => Promise<void> };
    App?: {
      addListener: (event: "appUrlOpen", handler: (data: { url: string }) => void) => Promise<unknown>;
      getLaunchUrl: () => Promise<{ url: string } | undefined>;
    };
    // iOS 앱에만 있는 모도리 전용 기능(mobile/ios/App/App/MainViewController.swift). 예전 빌드에는 없다.
    Modori?: {
      pageReady?: () => Promise<void>;
      signIn?: (options: { url: string; callbackScheme: string }) => Promise<{ url: string }>;
    };
    // @capacitor/push-notifications. 푸시 알림(받은 반응, 새 팔로워)을 받는 앱 기능.
    PushNotifications?: {
      checkPermissions: () => Promise<{ receive: string }>;
      requestPermissions: () => Promise<{ receive: string }>;
      register: () => Promise<void>;
      addListener: (event: string, handler: (data: never) => void) => Promise<unknown>;
    };
  };
};

/** 가입 경로 이름(lib/signup-source.ts). Android가 먼저 나와서 모르는 경우는 그쪽으로 센다. */
export function appSource(bridge: CapacitorBridge): "app-ios" | "app-android" {
  return bridge.getPlatform?.() === "ios" ? "app-ios" : "app-android";
}

/**
 * modori://login?code=… 를 받아 처음 만든 verifier와 함께 서버에 보내 로그인 세션을 받는다(/api/desktop/exchange).
 * 코드는 한 번만 쓰고, verifier가 없으면(다른 기기에서 온 링크) 쓰지 않는다. 받았으면 true.
 */
export function finishNativeLogin(link: string): boolean {
  const code = codeFromLink(link);
  if (!code) return false;
  const verifier = localStorage.getItem(VERIFIER_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  if (!verifier) return false;
  const exchange = new URL("/api/desktop/exchange", window.location.origin);
  exchange.searchParams.set("code", code);
  exchange.searchParams.set("verifier", verifier);
  window.location.href = exchange.toString();
  return true;
}

export function capacitor(): CapacitorBridge | null {
  const bridge = (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
  return bridge?.isNativePlatform?.() ? bridge : null;
}
