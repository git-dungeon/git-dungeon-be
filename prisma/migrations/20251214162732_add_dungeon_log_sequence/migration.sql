-- DropIndex
DROP INDEX "DungeonLog_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "DungeonLog" ADD COLUMN     "sequence" BIGSERIAL NOT NULL;

-- CreateIndex
CREATE INDEX "DungeonLog_userId_sequence_idx" ON "DungeonLog"("userId", "sequence");
