"use server";

import { signOut } from "@/lib/auth";
import { normalizeNickname } from "@/lib/nickname";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type DeleteAccountState = { message: string } | null;

/**
 * 계정과 그에 딸린 모든 기록을 지운다.
 * 스키마에서 User를 참조하는 관계가 전부 Cascade라, 사용자 한 행을 지우면
 * 할 일, 카테고리, 루틴, 팔로우, 반응, 로그인 정보가 같이 사라진다.
 */
export async function deleteAccount(
  _previous: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const user = await requireUser();

  const typed = normalizeNickname(formData.get("confirm"));
  if (typed !== user.nickname) {
    return { message: "닉네임이 달라요. 지금 쓰는 닉네임을 그대로 입력해주세요." };
  }

  // 세션을 먼저 끊는다. 계정을 먼저 지우면 Auth.js가 이미 사라진 세션 행을
  // 지우려다 실패한다. 여기서 실패하면 계정은 그대로 남으므로 다시 시도하면 된다.
  await signOut({ redirect: false });

  await prisma.user.delete({ where: { id: user.id } });

  // redirect는 예외를 던져서 동작하므로 try 안에 두지 않는다.
  await signOut({ redirectTo: "/login" });
  return null;
}
