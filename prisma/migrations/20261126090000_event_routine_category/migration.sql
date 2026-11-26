-- AlterTable
ALTER TABLE "EventRoutine" ADD COLUMN     "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "EventRoutine_categoryId_idx" ON "EventRoutine"("categoryId");

-- AddForeignKey
ALTER TABLE "EventRoutine" ADD CONSTRAINT "EventRoutine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
