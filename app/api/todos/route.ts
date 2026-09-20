import { NextResponse } from "next/server";

import { parseKSTDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const content = typeof formData.get("content") === "string" ? String(formData.get("content")).trim().slice(0, 200) : "";
  const dateString = typeof formData.get("date") === "string" ? String(formData.get("date")) : "";
  const categoryId = typeof formData.get("categoryId") === "string" ? String(formData.get("categoryId")) || null : null;
  if (!content) return NextResponse.json({ error: "할 일을 입력해 주세요." }, { status: 400 });
  let date: Date;
  try {
    date = parseKSTDate(dateString);
  } catch {
    return NextResponse.json({ error: "날짜 형식이 올바르지 않다." }, { status: 400 });
  }
  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id }, select: { id: true } });
    if (!category) return NextResponse.json({ error: "카테고리를 찾을 수 없다." }, { status: 400 });
  }
  const last = await prisma.todo.findFirst({ where: { userId: user.id, date }, orderBy: { order: "desc" }, select: { order: true } });
  await prisma.todo.create({ data: { userId: user.id, content, date, categoryId, order: (last?.order ?? -1) + 1 } });
  return NextResponse.redirect(new URL(`/?date=${dateString}&added=${Date.now()}`, request.url));
}
