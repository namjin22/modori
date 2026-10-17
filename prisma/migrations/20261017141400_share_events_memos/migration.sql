-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "memoPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EventRoutine" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Todo" ADD COLUMN     "memoPublic" BOOLEAN NOT NULL DEFAULT false;
