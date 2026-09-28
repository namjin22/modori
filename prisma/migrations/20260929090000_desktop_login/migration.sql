-- 데스크톱 앱 로그인용 한 번 쓰는 코드. 새 표만 만든다.
CREATE TABLE "DesktopLogin" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopLogin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesktopLogin_codeHash_key" ON "DesktopLogin"("codeHash");
CREATE INDEX "DesktopLogin_expiresAt_idx" ON "DesktopLogin"("expiresAt");

ALTER TABLE "DesktopLogin" ADD CONSTRAINT "DesktopLogin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
