-- AlterTable
ALTER TABLE "Todo" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Todo_parentId_idx" ON "Todo"("parentId");

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Todo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
