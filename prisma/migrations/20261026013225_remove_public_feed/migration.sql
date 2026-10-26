-- 공개 피드(2026-10-19)를 뺐다(2026-10-26 운영자 결정, docs/decisions.md "공개 피드를 뺀다").
-- 코드는 먼저 배포해 새 버전이 정상인 것을 확인했고(10/26), 운영 DB의 Post·PostPhoto·PostReaction·Report.postId는 지울 때 0건이었다.
-- 운영자가 표 삭제를 승인했다. 사용자 데이터를 지우는 것이 아니다.
/*
  Warnings:

  - You are about to drop the column `postId` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PostPhoto` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PostReaction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_userId_fkey";

-- DropForeignKey
ALTER TABLE "PostPhoto" DROP CONSTRAINT "PostPhoto_postId_fkey";

-- DropForeignKey
ALTER TABLE "PostReaction" DROP CONSTRAINT "PostReaction_postId_fkey";

-- DropForeignKey
ALTER TABLE "PostReaction" DROP CONSTRAINT "PostReaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_postId_fkey";

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "postId";

-- DropTable
DROP TABLE "Post";

-- DropTable
DROP TABLE "PostPhoto";

-- DropTable
DROP TABLE "PostReaction";
