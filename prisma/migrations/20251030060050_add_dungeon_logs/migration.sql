-- CreateEnum
CREATE TYPE "DungeonLogCategory" AS ENUM ('EXPLORATION', 'STATUS');

-- CreateEnum
CREATE TYPE "DungeonLogAction" AS ENUM ('BATTLE', 'MOVE', 'REST', 'TRAP', 'TREASURE', 'ACQUIRE_ITEM', 'EQUIP_ITEM', 'UNEQUIP_ITEM', 'DISCARD_ITEM', 'BUFF_APPLIED', 'BUFF_EXPIRED');

-- CreateEnum
CREATE TYPE "DungeonLogStatus" AS ENUM ('STARTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "DungeonLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "DungeonLogCategory" NOT NULL,
    "action" "DungeonLogAction" NOT NULL,
    "status" "DungeonLogStatus" NOT NULL DEFAULT 'STARTED',
    "floor" INTEGER,
    "turnNumber" INTEGER,
    "stateVersionBefore" INTEGER,
    "stateVersionAfter" INTEGER,
    "delta" JSONB,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DungeonLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DungeonStateSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "turnNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statePayload" JSONB NOT NULL,
    "reason" TEXT,

    CONSTRAINT "DungeonStateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DungeonLog_userId_createdAt_idx" ON "DungeonLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DungeonLog_category_action_idx" ON "DungeonLog"("category", "action");

-- CreateIndex
CREATE INDEX "DungeonLog_createdAt_idx" ON "DungeonLog"("createdAt");

-- CreateIndex
CREATE INDEX "DungeonStateSnapshot_userId_turnNumber_idx" ON "DungeonStateSnapshot"("userId", "turnNumber");

-- CreateIndex
CREATE INDEX "DungeonStateSnapshot_createdAt_idx" ON "DungeonStateSnapshot"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DungeonStateSnapshot_userId_version_key" ON "DungeonStateSnapshot"("userId", "version");

-- AddForeignKey
ALTER TABLE "DungeonLog" ADD CONSTRAINT "DungeonLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonStateSnapshot" ADD CONSTRAINT "DungeonStateSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
