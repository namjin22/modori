-- AlterEnum
ALTER TYPE "ApiTokenScope" ADD VALUE 'FULL';

-- AlterTable
ALTER TABLE "ApiToken" ADD COLUMN     "allowFriends" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "McpBatch" ADD COLUMN     "snapshot" JSONB;
