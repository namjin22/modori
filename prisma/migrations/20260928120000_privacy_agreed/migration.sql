-- 가입할 때 개인정보 수집·이용에 동의한 시각. 이 기능 전에 가입한 계정은 비어 있다.
ALTER TABLE "User" ADD COLUMN "privacyAgreedAt" TIMESTAMP(3);
