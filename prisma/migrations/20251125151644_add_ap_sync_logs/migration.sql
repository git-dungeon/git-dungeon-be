-- CreateEnum
CREATE TYPE "ApSyncStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ApSyncTokenType" AS ENUM ('OAUTH', 'PAT');

-- CreateTable
CREATE TABLE "ApSyncLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "contributions" INTEGER NOT NULL,
    "apDelta" INTEGER NOT NULL,
    "tokenType" "ApSyncTokenType" NOT NULL,
    "rateLimitRemaining" INTEGER,
    "cursor" TEXT,
    "meta" JSONB,
    "status" "ApSyncStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApSyncLog_userId_createdAt_idx" ON "ApSyncLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApSyncLog_userId_windowStart_windowEnd_key" ON "ApSyncLog"("userId", "windowStart", "windowEnd");

-- AddForeignKey
ALTER TABLE "ApSyncLog" ADD CONSTRAINT "ApSyncLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
