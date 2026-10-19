import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { readSubscription, vapidFromEnv } from "@/lib/web-push";

// 컴퓨터 브라우저의 웹 푸시 구독(lib/web-push-client.ts가 부른다). 쿠키 세션은 SameSite=Lax라 다른 사이트에서 대신 보낼 수 없다.

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    console.warn("[web-push] 본문이 JSON이 아니다.", error instanceof Error ? error.name : error);
    return null;
  }
}

/** 브라우저가 구독할 때 쓰는 서버 공개 열쇠. 서버에 열쇠가 없으면 404라, 켜는 쪽은 창이 열려 있을 때의 알림으로 남는다. */
export async function GET() {
  const vapid = vapidFromEnv();
  if (!vapid) return new Response(null, { status: 404 });
  return Response.json({ publicKey: vapid.publicKey }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.nickname) return new Response(null, { status: 401 });
  const subscription = readSubscription(await readBody(request));
  if (!subscription) return new Response(null, { status: 400 });

  // 같은 브라우저가 다른 계정으로 켜면 그 계정으로 옮겨 온다. 앞 계정의 알림이 다음 사람에게 가지 않는다.
  await prisma.webPushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: { userId: user.id, ...subscription },
    update: { userId: user.id, p256dh: subscription.p256dh, auth: subscription.auth },
  });
  return new Response(null, { status: 204 });
}

/** 끄거나 로그아웃할 때 이 브라우저의 구독을 지운다. 내 계정의 것만 지운다. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const { endpoint } = ((await readBody(request)) ?? {}) as { endpoint?: unknown };
  if (typeof endpoint !== "string" || endpoint.length > 1024) return new Response(null, { status: 400 });
  await prisma.webPushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return new Response(null, { status: 204 });
}
