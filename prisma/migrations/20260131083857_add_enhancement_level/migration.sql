-- AlterEnum
ALTER TYPE "DungeonLogAction" ADD VALUE 'ENHANCE_ITEM';

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "enhancementLevel" INTEGER NOT NULL DEFAULT 0;
