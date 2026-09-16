"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_NICKNAME_LENGTH = 20;

// 빈 화면으로 시작하면 무엇부터 해야 할지 모른다. 지우거나 바꿀 수 있는 기본값을 준다.
const DEFAULT_CATEGORIES = [
  { name: "공부", color: "#00b26a" },
  { name: "운동", color: "#3b82f6" },
  { name: "생활", color: "#f59e0b" },
];

export async function saveNickname(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const raw = formData.get("nickname");
  const nickname = typeof raw === "string" ? raw.trim() : "";

  if (nickname.length === 0 || nickname.length > MAX_NICKNAME_LENGTH) {
    redirect("/onboarding?error=length");
  }

  const userId = session.user.id;

  await prisma.user.update({ where: { id: userId }, data: { nickname } });

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
