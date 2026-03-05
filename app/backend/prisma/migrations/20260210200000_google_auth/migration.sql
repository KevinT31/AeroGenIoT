ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "googleSub" TEXT;
ALTER TABLE "User" ADD COLUMN "authProvider" TEXT;
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
