-- CreateEnum
CREATE TYPE "DungeonAction" AS ENUM ('IDLE', 'EXPLORING', 'BATTLE', 'REST', 'TREASURE', 'TRAP');

-- CreateTable
CREATE TABLE "DungeonState" (
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "hp" INTEGER NOT NULL DEFAULT 0,
    "maxHp" INTEGER NOT NULL DEFAULT 0,
    "atk" INTEGER NOT NULL DEFAULT 0,
    "def" INTEGER NOT NULL DEFAULT 0,
    "luck" INTEGER NOT NULL DEFAULT 0,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "maxFloor" INTEGER NOT NULL DEFAULT 1,
    "floorProgress" INTEGER NOT NULL DEFAULT 0,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "ap" INTEGER NOT NULL DEFAULT 0,
    "currentAction" "DungeonAction" NOT NULL DEFAULT 'IDLE',
    "currentActionStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DungeonState_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "DungeonState_updatedAt_idx" ON "DungeonState"("updatedAt");

-- CreateIndex
CREATE INDEX "DungeonState_version_idx" ON "DungeonState"("version");

-- AddForeignKey
ALTER TABLE "DungeonState" ADD CONSTRAINT "DungeonState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
