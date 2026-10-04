-- AlterTable
ALTER TABLE "DailyStat" ADD COLUMN     "reactionsCharacter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sources" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signupSource" TEXT;
