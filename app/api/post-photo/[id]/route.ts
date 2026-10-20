import { isAdmin } from "@/lib/admin";
import { isId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { canSeePublicFeed, visiblePostsWhere } from "@/lib/public-feed";
import { getCurrentUser } from "@/lib/session";

/**
 * 피드 글의 사진 한 장을 이미지로 내려준다(2026-10-20). 주소는 글 id다.
 *
 * 글을 볼 수 있는 사람만 받는다: 로그인했고, 피드가 열렸고, 글이 숨겨지지 않았고, 서로 차단한 사이가 아니어야 한다
 * (lib/public-feed.ts의 visiblePostsWhere). 운영자는 신고된 글을 판단해야 해서 숨긴 글의 사진도 본다.
 * 글에 붙은 사진은 바뀌지 않으므로 오래 캐시해도 된다.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!isId(id) || !(await canSeePublicFeed(viewer.id))) return new Response(null, { status: 404 });

  const admin = await isAdmin(viewer.id);
  const post = await prisma.post.findFirst({
    where: { id, ...(admin ? {} : visiblePostsWhere(viewer.id)), photo: { isNot: null } },
    select: { photo: { select: { data: true } } },
  });
  if (!post?.photo) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(post.photo.data), {
    headers: {
      "Content-Type": "image/jpeg",
      // 로그인한 사람만 보는 그림이라 공용 캐시(CDN)에는 두지 않는다.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
