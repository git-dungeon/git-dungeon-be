-- AlterTable
ALTER TABLE "DungeonState" ADD COLUMN     "equipmentBonus" JSONB,
ADD COLUMN     "statsVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "modifierVersion" INTEGER NOT NULL DEFAULT 0;
