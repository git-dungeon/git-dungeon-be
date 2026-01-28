-- AlterEnum
ALTER TYPE "InventorySlot" ADD VALUE 'MATERIAL';

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;
