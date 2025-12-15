-- Enforce UUID types for IDs/FKs across auth + dungeon tables.
-- This migration assumes a test database that can be reset (tables may be empty).

-- Drop foreign keys referencing User(id)
ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_userId_fkey";
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE "DungeonState" DROP CONSTRAINT IF EXISTS "DungeonState_userId_fkey";
ALTER TABLE "DungeonLog" DROP CONSTRAINT IF EXISTS "DungeonLog_userId_fkey";
ALTER TABLE "DungeonStateSnapshot" DROP CONSTRAINT IF EXISTS "DungeonStateSnapshot_userId_fkey";
ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_userId_fkey";
ALTER TABLE "ApSyncLog" DROP CONSTRAINT IF EXISTS "ApSyncLog_userId_fkey";

-- Drop primary keys (type changes on PK columns)
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_pkey";
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_pkey";
ALTER TABLE "Verification" DROP CONSTRAINT IF EXISTS "Verification_pkey";
ALTER TABLE "DungeonState" DROP CONSTRAINT IF EXISTS "DungeonState_pkey";
ALTER TABLE "DungeonLog" DROP CONSTRAINT IF EXISTS "DungeonLog_pkey";
ALTER TABLE "DungeonStateSnapshot" DROP CONSTRAINT IF EXISTS "DungeonStateSnapshot_pkey";
ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_pkey";
ALTER TABLE "ApSyncLog" DROP CONSTRAINT IF EXISTS "ApSyncLog_pkey";

-- Convert User.id back to UUID (previous migrations moved it to TEXT)
ALTER TABLE "User"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Auth tables (better-auth)
ALTER TABLE "Account"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "userId" TYPE UUID USING "userId"::uuid;

ALTER TABLE "Session"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "userId" TYPE UUID USING "userId"::uuid;

ALTER TABLE "Verification"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Dungeon tables
ALTER TABLE "DungeonState"
  ALTER COLUMN "userId" TYPE UUID USING "userId"::uuid;

ALTER TABLE "DungeonLog"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "userId" TYPE UUID USING "userId"::uuid;

ALTER TABLE "DungeonStateSnapshot"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "userId" TYPE UUID USING "userId"::uuid;

ALTER TABLE "InventoryItem"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "userId" TYPE UUID USING "userId"::uuid;

ALTER TABLE "ApSyncLog"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "userId" TYPE UUID USING "userId"::uuid;

-- Re-add primary keys
ALTER TABLE "User" ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
ALTER TABLE "Account" ADD CONSTRAINT "Account_pkey" PRIMARY KEY ("id");
ALTER TABLE "Session" ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("id");
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_pkey" PRIMARY KEY ("id");
ALTER TABLE "DungeonState" ADD CONSTRAINT "DungeonState_pkey" PRIMARY KEY ("userId");
ALTER TABLE "DungeonLog" ADD CONSTRAINT "DungeonLog_pkey" PRIMARY KEY ("id");
ALTER TABLE "DungeonStateSnapshot" ADD CONSTRAINT "DungeonStateSnapshot_pkey" PRIMARY KEY ("id");
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id");
ALTER TABLE "ApSyncLog" ADD CONSTRAINT "ApSyncLog_pkey" PRIMARY KEY ("id");

-- Re-add foreign keys
ALTER TABLE "Account"
  ADD CONSTRAINT "Account_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DungeonState"
  ADD CONSTRAINT "DungeonState_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DungeonLog"
  ADD CONSTRAINT "DungeonLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DungeonStateSnapshot"
  ADD CONSTRAINT "DungeonStateSnapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApSyncLog"
  ADD CONSTRAINT "ApSyncLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

