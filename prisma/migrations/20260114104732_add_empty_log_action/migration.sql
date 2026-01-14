-- AlterEnum
ALTER TYPE "DungeonLogAction" ADD VALUE 'EMPTY';

-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ApSyncLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DungeonLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DungeonStateSnapshot" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InventoryItem" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Verification" ALTER COLUMN "id" DROP DEFAULT;
