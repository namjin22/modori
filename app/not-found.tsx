import Link from "next/link";

import { Dori } from "@/components/dori";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <Dori mood="confused" size={110} className="mx-auto" />
        <h1 className="mt-3 text-xl font-bold">없는 주소예요</h1>
        <p className="mt-2 text-sm text-muted">
          주소가 바뀌었거나 지워진 화면이에요.
        </p>
      </div>

      <Link
        href="/"
        className="flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-brand-contrast"
      >
        오늘 화면으로
      </Link>
    </main>
  );
}
