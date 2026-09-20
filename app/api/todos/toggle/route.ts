import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await requireUser();
  const isJson = request.headers.get("content-type")?.includes("application/json") ?? false;
  const body: unknown = isJson ? await request.json() : await request.formData();
  const id =
    typeof body === "object" && body !== null && "get" in body && typeof body.get === "function"
      ? body.get("id")
      : typeof body === "object" && body !== null && "id" in body && typeof body.id === "string"
        ? body.id
        : "";
  const desiredDone =
    typeof body === "object" && body !== null && "get" in body && typeof body.get === "function"
      ? body.get("done") === "true"
      : typeof body === "object" && body !== null && "done" in body && typeof body.done === "boolean"
        ? body.done
        : null;
  if (!id) return NextResponse.json({ error: "할 일을 찾을 수 없다." }, { status: 400 });

  const todo = await prisma.todo.findFirst({
    where: { id, userId: user.id },
    select: { done: true },
  });
  if (!todo) return NextResponse.json({ error: "할 일을 찾을 수 없다." }, { status: 404 });

  await prisma.todo.update({
    where: { id },
    data: {
      done: desiredDone ?? !todo.done,
      doneAt: (desiredDone ?? !todo.done) ? new Date() : null,
    },
  });

  if (isJson) return new NextResponse(null, { status: 204 });
  return NextResponse.redirect(new URL(request.headers.get("referer") ?? "/", request.url));
}
