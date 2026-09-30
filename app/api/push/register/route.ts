import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// 모바일 앱이 받은 기기 알림 번호(FCM 토큰)를 로그인한 계정에 묶는다(components/push-registrar.tsx).
// 쿠키 세션은 SameSite=Lax라 다른 사이트에서 이 POST를 대신 보낼 수 없다.
const PLATFORMS = ["android"];

async function readToken(request: Request): Promise<{ token: string; platform: string } | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    console.warn("[push] 본문이 JSON이 아니다.", error instanceof Error ? error.name : error);
    return null;
  }
  const { token, platform } = (body ?? {}) as { token?: unknown; platform?: unknown };
  if (typeof token !== "string" || token.length < 20 || token.length > 4096) return null;
  return { token, platform: typeof platform === "string" && PLATFORMS.includes(platform) ? platform : "android" };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.nickname) return new Response(null, { status: 401 });
  const read = await readToken(request);
  if (!read) return new Response(null, { status: 400 });

  // 같은 기기가 다른 계정으로 로그인하면 그 계정으로 옮겨 온다.
  await prisma.pushToken.upsert({
    where: { token: read.token },
    create: { userId: user.id, token: read.token, platform: read.platform },
    update: { userId: user.id, platform: read.platform },
  });
  return new Response(null, { status: 204 });
}

/** 로그아웃 때 이 기기의 번호를 지운다. 내 계정의 것만 지운다. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const read = await readToken(request);
  if (!read) return new Response(null, { status: 400 });
  await prisma.pushToken.deleteMany({ where: { token: read.token, userId: user.id } });
  return new Response(null, { status: 204 });
}
