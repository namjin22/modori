-- 목표 기능을 세부 할 일로 바꿨다(2026-11-20, 운영자 승인). 사용자가 만든 목표 데이터가 영구히 지워진다.
-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_goalId_fkey";

-- DropIndex
DROP INDEX "Todo_goalId_idx";

-- AlterTable
ALTER TABLE "Todo" DROP COLUMN "goalId";

-- DropTable
DROP TABLE "Goal";
