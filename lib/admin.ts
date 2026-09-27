import { prisma } from "@/lib/prisma";
import { PRIVACY_MANAGER } from "@/lib/privacy";

// 운영자. 오류 기록(/admin/errors)을 볼 수 있다. 개인정보 보호책임자와 같은 사람이다.
const ADMIN_EMAILS = [PRIVACY_MANAGER.email];

export async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
}
