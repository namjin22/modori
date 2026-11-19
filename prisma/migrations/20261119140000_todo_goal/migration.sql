-- AlterTable
ALTER TABLE "Todo" ADD COLUMN     "goalId" TEXT;

-- CreateIndex
CREATE INDEX "Todo_goalId_idx" ON "Todo"("goalId");

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

