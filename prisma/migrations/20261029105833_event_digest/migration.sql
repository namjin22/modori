-- AlterTable
ALTER TABLE "User" ADD COLUMN     "eventDigestMinute" INTEGER DEFAULT 360,
ADD COLUMN     "eventDigestSentOn" DATE;
