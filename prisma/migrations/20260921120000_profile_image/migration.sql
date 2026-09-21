-- 프로필을 이모지 대신 올린 사진으로 바꾼다.
-- profileEmoji를 지우는 것은 사용자 승인을 받았다.
ALTER TABLE "User" DROP COLUMN "profileEmoji",
ADD COLUMN     "profileImage" TEXT;
