-- CreateEnum
CREATE TYPE "InventorySlot" AS ENUM ('WEAPON', 'ARMOR', 'HELMET', 'RING', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "InventoryRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slot" "InventorySlot" NOT NULL,
    "rarity" "InventoryRarity" NOT NULL,
    "modifiers" JSONB NOT NULL,
    "isEquipped" BOOLEAN NOT NULL DEFAULT false,
    "obtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItem_userId_slot_idx" ON "InventoryItem"("userId", "slot");

-- CreateIndex
CREATE INDEX "InventoryItem_userId_code_idx" ON "InventoryItem"("userId", "code");

-- CreateIndex
CREATE INDEX "InventoryItem_userId_isEquipped_idx" ON "InventoryItem"("userId", "isEquipped");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ensure only one equipped item per slot and user
CREATE UNIQUE INDEX "InventoryItem_userId_slot_equipped_unique"
ON "InventoryItem"("userId", "slot")
WHERE "isEquipped" = true;
