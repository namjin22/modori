import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * 프로필 사진 한 장을 이미지로 내려준다. 주소는 lib/avatar.ts가 만든다.
 *
 * 로그인한 사람만 볼 수 있다. 친구 찾기에서 누구나 서로의 사진을 보므로 팔로우
 * 여부는 따지지 않는다. 주소에 사진 내용의 값이 붙어 있어서 오래 캐시해도 된다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getCurrentUser();
  if (!viewer) return new Response(null, { status: 401 });

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { profileImage: true },
  });

  const match = user?.profileImage ? DATA_URL.exec(user.profileImage) : null;
  if (!match) return new Response(null, { status: 404 });

  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      // 로그인한 사람만 보는 그림이라 공용 캐시(CDN)에는 두지 않는다.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
