-- Squashed init migration (dev only; no legacy data assumed)
-- Generated from prisma/schema.prisma on 2025-12-15

-- Ensure required extensions for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ApSyncStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "public"."ApSyncTokenType" AS ENUM ('OAUTH', 'PAT');

-- CreateEnum
CREATE TYPE "public"."DungeonAction" AS ENUM ('IDLE', 'EXPLORING', 'BATTLE', 'REST', 'TREASURE', 'TRAP');

-- CreateEnum
CREATE TYPE "public"."DungeonLogAction" AS ENUM ('BATTLE', 'MOVE', 'REST', 'TRAP', 'TREASURE', 'ACQUIRE_ITEM', 'EQUIP_ITEM', 'UNEQUIP_ITEM', 'DISCARD_ITEM', 'BUFF_APPLIED', 'BUFF_EXPIRED', 'DEATH', 'LEVEL_UP', 'REVIVE');

-- CreateEnum
CREATE TYPE "public"."DungeonLogCategory" AS ENUM ('EXPLORATION', 'STATUS');

-- CreateEnum
CREATE TYPE "public"."DungeonLogStatus" AS ENUM ('STARTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."InventoryRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "public"."InventorySlot" AS ENUM ('WEAPON', 'ARMOR', 'HELMET', 'RING', 'CONSUMABLE');

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "providerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApSyncLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "contributions" INTEGER NOT NULL,
    "apDelta" INTEGER NOT NULL,
    "tokenType" "public"."ApSyncTokenType" NOT NULL,
    "rateLimitRemaining" INTEGER,
    "cursor" TEXT,
    "meta" JSONB,
    "status" "public"."ApSyncStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DungeonLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "category" "public"."DungeonLogCategory" NOT NULL,
    "action" "public"."DungeonLogAction" NOT NULL,
    "status" "public"."DungeonLogStatus" NOT NULL DEFAULT 'STARTED',
    "floor" INTEGER,
    "turnNumber" INTEGER,
    "stateVersionBefore" INTEGER,
    "stateVersionAfter" INTEGER,
    "delta" JSONB,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence" BIGSERIAL NOT NULL,

    CONSTRAINT "DungeonLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DungeonState" (
    "userId" UUID NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "hp" INTEGER NOT NULL DEFAULT 10,
    "maxHp" INTEGER NOT NULL DEFAULT 10,
    "atk" INTEGER NOT NULL DEFAULT 1,
    "def" INTEGER NOT NULL DEFAULT 1,
    "luck" INTEGER NOT NULL DEFAULT 1,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "maxFloor" INTEGER NOT NULL DEFAULT 1,
    "floorProgress" INTEGER NOT NULL DEFAULT 0,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "ap" INTEGER NOT NULL DEFAULT 0,
    "currentAction" "public"."DungeonAction" NOT NULL DEFAULT 'IDLE',
    "currentActionStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DungeonState_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."DungeonStateSnapshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "turnNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statePayload" JSONB NOT NULL,
    "reason" TEXT,

    CONSTRAINT "DungeonStateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InventoryItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "slot" "public"."InventorySlot" NOT NULL,
    "rarity" "public"."InventoryRarity" NOT NULL,
    "modifiers" JSONB NOT NULL,
    "isEquipped" BOOLEAN NOT NULL DEFAULT false,
    "obtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastRequest" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Verification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "public"."Account"("providerId" ASC, "accountId" ASC);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "public"."Account"("userId" ASC);

-- CreateIndex
CREATE INDEX "ApSyncLog_userId_createdAt_idx" ON "public"."ApSyncLog"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ApSyncLog_userId_windowStart_windowEnd_key" ON "public"."ApSyncLog"("userId" ASC, "windowStart" ASC, "windowEnd" ASC);

-- CreateIndex
CREATE INDEX "DungeonLog_category_action_idx" ON "public"."DungeonLog"("category" ASC, "action" ASC);

-- CreateIndex
CREATE INDEX "DungeonLog_createdAt_idx" ON "public"."DungeonLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "DungeonLog_userId_sequence_idx" ON "public"."DungeonLog"("userId" ASC, "sequence" ASC);

-- CreateIndex
CREATE INDEX "DungeonState_updatedAt_idx" ON "public"."DungeonState"("updatedAt" ASC);

-- CreateIndex
CREATE INDEX "DungeonState_version_idx" ON "public"."DungeonState"("version" ASC);

-- CreateIndex
CREATE INDEX "DungeonStateSnapshot_createdAt_idx" ON "public"."DungeonStateSnapshot"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "DungeonStateSnapshot_userId_turnNumber_idx" ON "public"."DungeonStateSnapshot"("userId" ASC, "turnNumber" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DungeonStateSnapshot_userId_version_key" ON "public"."DungeonStateSnapshot"("userId" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "InventoryItem_userId_code_idx" ON "public"."InventoryItem"("userId" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "InventoryItem_userId_isEquipped_idx" ON "public"."InventoryItem"("userId" ASC, "isEquipped" ASC);

-- CreateIndex
CREATE INDEX "InventoryItem_userId_slot_idx" ON "public"."InventoryItem"("userId" ASC, "slot" ASC);

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "public"."Session"("expiresAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "public"."Session"("token" ASC);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE INDEX "Verification_expiresAt_idx" ON "public"."Verification"("expiresAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Verification_identifier_value_key" ON "public"."Verification"("identifier" ASC, "value" ASC);

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApSyncLog" ADD CONSTRAINT "ApSyncLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DungeonLog" ADD CONSTRAINT "DungeonLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DungeonState" ADD CONSTRAINT "DungeonState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DungeonStateSnapshot" ADD CONSTRAINT "DungeonStateSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Ensure only one equipped item per slot and user
CREATE UNIQUE INDEX "InventoryItem_userId_slot_equipped_unique"
ON "public"."InventoryItem"("userId", "slot")
WHERE "isEquipped" = true;
