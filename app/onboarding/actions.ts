"use server";

import { Prisma } from "@prisma/client";

import { redirect } from "next/navigation";

import {
  isNicknameTaken,
  normalizeNickname,
  MAX_NICKNAME_LENGTH,
  validateNickname,
} from "@/lib/nickname";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// 빈 화면으로 시작하면 무엇부터 해야 할지 모른다. 지우거나 바꿀 수 있는 기본값을 준다.
// 색으로 구분하는 서비스라 기본값부터 서로 뚜렷하게 다른 색을 쓴다.
// 브랜드 파랑과 겹치면 카테고리 색인지 버튼 색인지 구분이 안 된다.
const DEFAULT_CATEGORIES = [
  { name: "공부", color: "#8b5cf6" },
  { name: "운동", color: "#00b26a" },
  { name: "생활", color: "#f59e0b" },
];

export type OnboardingState = { message: string } | null;

export async function saveNickname(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const userId = user.id;
  const nickname = normalizeNickname(formData.get("nickname"));

  const valid = validateNickname(nickname);
  if (!valid.ok) return { message: `닉네임은 1~${MAX_NICKNAME_LENGTH}자로 적어주세요.` };

  if (await isNicknameTaken(nickname, userId)) {
    return { message: "이미 쓰고 있는 닉네임이에요. 다른 이름으로 해주세요." };
  }

  try {
    await prisma.user.update({ where: { id: userId }, data: { nickname } });
  } catch (error) {
    // 같은 순간에 같은 이름으로 둘이 저장하면 여기서 걸린다.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: "방금 누군가 같은 닉네임을 가져갔어요. 다시 골라주세요." };
    }
    throw error;
  }

  // 온보딩을 다시 밟는 경우(닉네임만 지운 계정)에 중복으로 만들지 않는다.
  const existing = await prisma.category.count({ where: { userId } });
  if (existing === 0) {
    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((category, index) => ({
        ...category,
        userId,
        order: index,
      })),
    });
  }

  redirect("/");
}
