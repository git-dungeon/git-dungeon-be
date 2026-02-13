-- CreateEnum
CREATE TYPE "UserCollectionTargetType" AS ENUM ('ITEM', 'MONSTER');

-- CreateTable
CREATE TABLE "UserCollectionEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "targetType" "UserCollectionTargetType" NOT NULL,
    "targetCode" TEXT NOT NULL,
    "firstDiscoveredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCollectionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCollectionEntry_userId_targetType_idx" ON "UserCollectionEntry"("userId", "targetType");

-- CreateIndex
CREATE INDEX "UserCollectionEntry_userId_createdAt_idx" ON "UserCollectionEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserCollectionEntry_userId_targetType_targetCode_key" ON "UserCollectionEntry"("userId", "targetType", "targetCode");

-- AddForeignKey
ALTER TABLE "UserCollectionEntry" ADD CONSTRAINT "UserCollectionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
