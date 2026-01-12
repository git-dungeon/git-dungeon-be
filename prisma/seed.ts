import {
  PrismaClient,
  Prisma,
  DungeonLogCategory,
  DungeonLogAction,
  DungeonLogStatus,
} from '@prisma/client';
import { toJsonDetails } from '../src/common/logs/dungeon-log-extra';
import { toJsonDelta } from '../src/common/logs/dungeon-log-delta';
import { loadEnvironment } from '../src/config/environment';

const prisma = new PrismaClient();

async function main() {
  const env = loadEnvironment();
  const initialAp = env.dungeonInitialAp ?? 10;

  const email = 'admin@example.com';

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Administrator',
    },
  });

  await prisma.dungeonState.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      level: 1,
      exp: 0,
      hp: 10,
      maxHp: 10,
      atk: 1,
      def: 1,
      luck: 1,
      floor: 1,
      maxFloor: 1,
      floorProgress: 0,
      gold: 0,
      ap: initialAp,
      currentAction: 'IDLE',
      currentActionStartedAt: null,
    },
  });

  await prisma.dungeonLog.deleteMany({ where: { userId: user.id } });
  await prisma.dungeonStateSnapshot.deleteMany({ where: { userId: user.id } });
  await prisma.inventoryItem.deleteMany({ where: { userId: user.id } });

  const seedWithSamples = process.env.SEED_WITH_SAMPLES === 'true';
  if (!seedWithSamples) {
    console.info('Seeded user:', user.email);
    console.info('Seeded dungeon state for:', user.email);
    console.info('Seed samples skipped (SEED_WITH_SAMPLES=false).');
    return;
  }

  const baseTime = new Date();

  const inventoryItems: Prisma.InventoryItemUncheckedCreateInput[] = [
    {
      userId: user.id,
      code: 'weapon-longsword',
      slot: 'WEAPON',
      rarity: 'RARE',
      modifiers: [
        { kind: 'stat', stat: 'atk', mode: 'flat', value: 5 },
      ] as unknown as Prisma.InputJsonValue,
      isEquipped: true,
      obtainedAt: new Date(baseTime.getTime() - 1000 * 60 * 10),
      version: 3,
    },
    {
      userId: user.id,
      code: 'weapon-wooden-sword',
      slot: 'WEAPON',
      rarity: 'COMMON',
      modifiers: [
        { kind: 'stat', stat: 'atk', mode: 'flat', value: 1 },
      ] as unknown as Prisma.InputJsonValue,
      isEquipped: false,
      obtainedAt: new Date(baseTime.getTime() - 1000 * 60 * 30),
      version: 2,
    },
    {
      userId: user.id,
      code: 'ring-topaz',
      slot: 'RING',
      rarity: 'UNCOMMON',
      modifiers: [
        { kind: 'stat', stat: 'luck', mode: 'flat', value: 2 },
        { kind: 'stat', stat: 'hp', mode: 'flat', value: 2 },
      ] as unknown as Prisma.InputJsonValue,
      isEquipped: true,
      obtainedAt: new Date(baseTime.getTime() - 1000 * 60 * 25),
      version: 4,
    },
    {
      userId: user.id,
      code: 'armor-steel-armor',
      slot: 'ARMOR',
      rarity: 'UNCOMMON',
      modifiers: [
        { kind: 'stat', stat: 'def', mode: 'flat', value: 4 },
        { kind: 'stat', stat: 'luck', mode: 'percent', value: 0.05 },
      ] as unknown as Prisma.InputJsonValue,
      isEquipped: true,
      obtainedAt: new Date(baseTime.getTime() - 1000 * 60 * 40),
      version: 5,
    },
    {
      userId: user.id,
      code: 'helmet-leather-cap',
      slot: 'HELMET',
      rarity: 'COMMON',
      modifiers: [
        {
          kind: 'stat',
          stat: 'def',
          mode: 'flat',
          value: 1,
        },
      ] as unknown as Prisma.InputJsonValue,
      isEquipped: false,
      obtainedAt: new Date(baseTime.getTime() - 1000 * 60 * 15),
      version: 1,
    },
  ];

  await prisma.inventoryItem.createMany({ data: inventoryItems });

  const snapshots: Prisma.DungeonStateSnapshotUncheckedCreateInput[] = [
    {
      userId: user.id,
      version: 20,
      turnNumber: 200,
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 5),
      statePayload: {
        level: 2,
        exp: 45,
        hp: 18,
        maxHp: 20,
        atk: 6,
        def: 4,
        luck: 3,
        floor: 5,
        maxFloor: 7,
        floorProgress: 40,
        gold: 120,
        ap: 4,
        currentAction: 'EXPLORING',
      } as Prisma.InputJsonValue,
      reason: 'TURN_START',
    },
    {
      userId: user.id,
      version: 21,
      turnNumber: 201,
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 3),
      statePayload: {
        level: 2,
        exp: 65,
        hp: 9,
        maxHp: 20,
        atk: 6,
        def: 4,
        luck: 3,
        floor: 5,
        maxFloor: 7,
        floorProgress: 70,
        gold: 150,
        ap: 3,
        currentAction: 'BATTLE',
      } as Prisma.InputJsonValue,
      reason: 'TURN_START',
    },
  ];

  await prisma.dungeonStateSnapshot.createMany({ data: snapshots });

  const logs: Prisma.DungeonLogUncheckedCreateInput[] = [
    {
      userId: user.id,
      category: DungeonLogCategory.EXPLORATION,
      action: DungeonLogAction.BATTLE,
      status: DungeonLogStatus.STARTED,
      floor: 5,
      turnNumber: 200,
      stateVersionBefore: 20,
      stateVersionAfter: 20,
      delta: toJsonDelta({
        type: 'BATTLE',
        detail: {
          stats: { ap: -1 },
        },
      }) as Prisma.InputJsonValue,
      extra: toJsonDetails({
        type: 'BATTLE',
        details: {
          monster: {
            code: 'monster-giant-rat',
            name: '거대 쥐',
            hp: 24,
            atk: 3,
            def: 0,
            spriteId: 'monster-giant-rat',
          },
          player: {
            hp: 10,
            maxHp: 12,
            atk: 6,
            def: 5,
            luck: 3,
            stats: {
              base: { hp: 10, atk: 1, def: 1, luck: 1 },
              equipmentBonus: { hp: 2, atk: 5, def: 4, luck: 2 },
              total: { hp: 12, atk: 6, def: 5, luck: 3 },
            },
            level: 1,
            exp: 0,
            expToLevel: 10,
          },
        },
      }) as Prisma.InputJsonValue,
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 4),
    },
    {
      userId: user.id,
      category: DungeonLogCategory.EXPLORATION,
      action: DungeonLogAction.BATTLE,
      status: DungeonLogStatus.COMPLETED,
      floor: 5,
      turnNumber: 200,
      stateVersionBefore: 20,
      stateVersionAfter: 20,
      delta: toJsonDelta({
        type: 'BATTLE',
        detail: {
          stats: { hp: -5 },
          rewards: { gold: 35, items: [] },
        },
      }) as Prisma.InputJsonValue,
      extra: toJsonDetails({
        type: 'BATTLE',
        details: {
          monster: {
            code: 'monster-giant-rat',
            name: '거대 쥐',
            hp: 0,
            atk: 3,
            def: 0,
            spriteId: 'monster-giant-rat',
          },
          player: {
            hp: 5,
            maxHp: 12,
            atk: 6,
            def: 5,
            luck: 3,
            stats: {
              base: { hp: 10, atk: 1, def: 1, luck: 1 },
              equipmentBonus: { hp: 2, atk: 5, def: 4, luck: 2 },
              total: { hp: 12, atk: 6, def: 5, luck: 3 },
            },
            level: 1,
            exp: 3,
            expToLevel: 10,
          },
          result: 'VICTORY',
        },
      }) as Prisma.InputJsonValue,
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 4 + 10_000),
    },
    {
      userId: user.id,
      category: DungeonLogCategory.STATUS,
      action: DungeonLogAction.ACQUIRE_ITEM,
      status: DungeonLogStatus.COMPLETED,
      floor: null,
      turnNumber: 201,
      stateVersionBefore: 20,
      stateVersionAfter: 20,
      delta: toJsonDelta({
        type: 'ACQUIRE_ITEM',
        detail: {
          inventory: {
            added: [
              {
                itemId: 'helmet-leather-cap',
                code: 'helmet-leather-cap',
                slot: 'HELMET',
                rarity: 'common',
                quantity: 1,
              },
            ],
          },
        },
      }) as Prisma.InputJsonValue,
      extra: toJsonDetails({
        type: 'ACQUIRE_ITEM',
        details: {
          reward: {
            source: 'battle-drop',
          },
        },
      }) as Prisma.InputJsonValue,
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 3 + 5_000),
    },
    {
      userId: user.id,
      category: DungeonLogCategory.STATUS,
      action: DungeonLogAction.EQUIP_ITEM,
      status: DungeonLogStatus.COMPLETED,
      floor: null,
      turnNumber: 201,
      stateVersionBefore: 20,
      stateVersionAfter: 21,
      delta: toJsonDelta({
        type: 'EQUIP_ITEM',
        detail: {
          inventory: {
            equipped: {
              slot: 'WEAPON',
              itemId: 'weapon-longsword',
              code: 'weapon-longsword',
            },
            unequipped: {
              slot: 'WEAPON',
              itemId: 'weapon-wooden-sword',
              code: 'weapon-wooden-sword',
            },
          },
          stats: { atk: 5, ap: -1 },
        },
      }) as Prisma.InputJsonValue,
      extra: toJsonDetails({
        type: 'EQUIP_ITEM',
        details: {
          item: {
            id: 'weapon-longsword',
            code: 'weapon-longsword',
            name: 'Longsword',
            slot: 'weapon',
            rarity: 'rare',
            modifiers: [{ kind: 'stat', stat: 'atk', mode: 'flat', value: 5 }],
          },
        },
      }) as Prisma.InputJsonValue,
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 3),
    },
    {
      userId: user.id,
      category: DungeonLogCategory.STATUS,
      action: DungeonLogAction.BUFF_APPLIED,
      status: DungeonLogStatus.COMPLETED,
      floor: null,
      turnNumber: 201,
      stateVersionBefore: 21,
      stateVersionAfter: 21,
      delta: toJsonDelta({
        type: 'BUFF_APPLIED',
        detail: {
          applied: [
            {
              buffId: 'angel-ring-resurrection',
              source: 'angel-ring',
              totalTurns: null,
              remainingTurns: null,
            },
          ],
        },
      }) as Prisma.InputJsonValue,
      extra: toJsonDetails({
        type: 'BUFF_APPLIED',
        details: {
          buffId: 'angel-ring-resurrection',
          source: 'angel-ring',
          effect: 'HP가 0이 되면 한 번 부활',
          spriteId: 'buff-angel-ring',
          totalTurns: null,
          remainingTurns: null,
        },
      }) as Prisma.InputJsonValue,
      createdAt: new Date(baseTime.getTime() - 1000 * 60 * 2),
    },
    {
      userId: user.id,
      category: DungeonLogCategory.STATUS,
      action: DungeonLogAction.BUFF_EXPIRED,
      status: DungeonLogStatus.COMPLETED,
      floor: null,
      turnNumber: 205,
      stateVersionBefore: 23,
      stateVersionAfter: 23,
      delta: toJsonDelta({
        type: 'BUFF_EXPIRED',
        detail: {
          expired: [
            {
              buffId: 'angel-ring-resurrection',
              expiredAtTurn: 205,
              consumedBy: 'resurrection',
            },
          ],
        },
      }) as Prisma.InputJsonValue,
      extra: toJsonDetails({
        type: 'BUFF_EXPIRED',
        details: {
          buffId: 'angel-ring-resurrection',
          consumedBy: 'resurrection',
          expiredAtTurn: 205,
        },
      }) as Prisma.InputJsonValue,
      createdAt: new Date(baseTime.getTime() - 1000 * 60),
    },
    {
      userId: user.id,
      category: DungeonLogCategory.EXPLORATION,
      action: DungeonLogAction.DEATH,
      status: DungeonLogStatus.COMPLETED,
      floor: 5,
      turnNumber: 205,
      stateVersionBefore: 23,
      stateVersionAfter: 24,
      delta: toJsonDelta({
        type: 'DEATH',
        detail: {
          stats: { hp: 20 },
          progress: { floor: 1, floorProgress: 0 },
          buffs: [
            {
              buffId: 'angel-ring-resurrection',
              consumedBy: 'resurrection',
            },
          ],
        },
      }) as Prisma.InputJsonValue,
      extra: toJsonDetails({
        type: 'DEATH',
        details: {
          cause: 'TRAP_DAMAGE',
          handledBy: 'resurrection',
        },
      }) as Prisma.InputJsonValue,
      createdAt: new Date(baseTime.getTime() - 1000 * 45),
    },
    {
      userId: user.id,
      category: DungeonLogCategory.STATUS,
      action: DungeonLogAction.LEVEL_UP,
      status: DungeonLogStatus.COMPLETED,
      floor: null,
      turnNumber: 210,
      stateVersionBefore: 24,
      stateVersionAfter: 25,
      delta: toJsonDelta({
        type: 'LEVEL_UP',
        detail: {
          stats: { level: 3, maxHp: 24, atk: 2 },
          rewards: { unlocks: [] },
        },
      }) as Prisma.InputJsonValue,
      extra: toJsonDetails({
        type: 'LEVEL_UP',
        details: {
          previousLevel: 2,
          currentLevel: 3,
          threshold: 120,
          statsGained: {},
        },
      }) as Prisma.InputJsonValue,
      createdAt: new Date(baseTime.getTime() - 1000 * 30),
    },
  ];

  for (const log of logs) {
    await prisma.dungeonLog.create({ data: log });
  }

  console.info('Seeded user:', user.email);
  console.info('Seeded dungeon state for:', user.email);
  console.info('Seeded dungeon logs:', logs.length);
  console.info('Seeded inventory items:', inventoryItems.length);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
