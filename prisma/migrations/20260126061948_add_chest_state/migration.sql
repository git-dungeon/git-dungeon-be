-- AlterTable
ALTER TABLE "DungeonState" ADD COLUMN     "chestRollIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unopenedChests" INTEGER NOT NULL DEFAULT 0;
