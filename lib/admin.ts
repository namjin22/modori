import { prisma } from "@/lib/prisma";
import { PRIVACY_MANAGER } from "@/lib/privacy";

/**
 * 운영자. 오류 기록(/admin/errors)·지표·사용자·신고를 볼 수 있다. 개인정보 보호책임자는 늘 운영자다.
 * 운영자를 더 두려면 서버 환경변수 ADMIN_EXTRA_EMAILS에 로그인 이메일을 쉼표로 적는다(2026-11-18 운영자 요청).
 * 저장소가 공개라 이메일을 코드에 적지 않고 서버에만 둔다. 이메일은 대소문자를 가리지 않는다.
 */
export function adminEmails(extra: string | undefined = process.env.ADMIN_EXTRA_EMAILS): string[] {
  const emails = [PRIVACY_MANAGER.email, ...(extra ?? "").split(",")].map((email) => email.trim().toLowerCase()).filter((email) => email !== "");
  return [...new Set(emails)];
}

export async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return Boolean(user?.email && adminEmails().includes(user.email.toLowerCase()));
}
