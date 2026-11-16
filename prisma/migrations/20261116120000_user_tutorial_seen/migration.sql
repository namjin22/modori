-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tutorialSeenAt" TIMESTAMP(3);

-- 이 칸을 만들 때 이미 있던 사용자에게는 사용법 카드를 자동으로 띄우지 않는다(2026-11-16 결정, docs/decisions.md).
-- 지우거나 바꾸는 값이 없고, 방금 만든 빈 칸을 채우는 것뿐이다.
UPDATE "User" SET "tutorialSeenAt" = CURRENT_TIMESTAMP;
