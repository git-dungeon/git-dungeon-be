import {
  PrismaClient,
  Prisma,
  DungeonLogCategory,
  DungeonLogAction,
  DungeonLogStatus,
} from '@prisma/client';
import { toJsonExtra } from '../src/common/logs/dungeon-log-extra';
import { toJsonDelta } from '../src/common/logs/dungeon-log-delta';

const prisma = new PrismaClient();

async function main() {
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
      ap: 5,
      currentAction: 'IDLE',
      currentActionStartedAt: null,
    },
  });

  await prisma.dungeonLog.deleteMany({ where: { userId: user.id } });
  await prisma.dungeonStateSnapshot.deleteMany({ where: { userId: user.id } });
  await prisma.inventoryItem.deleteMany({ where: { userId: user.id } });

  const baseTime = new Date();

  const inventoryItems: Prisma.InventoryItemUncheckedCreateInput[] = [
    {
      id: 'weapon-longsword',
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
      id: 'weapon-rusty-sword',
      userId: user.id,
      code: 'weapon-rusty-sword',
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
      id: 'ring-topaz',
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
      id: 'armor-steel-armor',
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
      id: 'potion-healing-small',
      userId: user.id,
      code: 'potion-healing-small',
      slot: 'CONSUMABLE',
      rarity: 'COMMON',
      modifiers: [
        {
          kind: 'effect',
          effectCode: 'restore-hp',
          params: { amount: 20 },
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
      extra: toJsonExtra({
        type: 'BATTLE',
        detail: {
          monster: {
            id: 'monster-giant-rat',
            name: '거대 쥐',
            hp: 24,
            atk: 3,
            spriteId: 'monster-giant-rat',
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
          stats: { hp: -5, ap: -1 },
          gold: 35,
        },
      }) as Prisma.InputJsonValue,
      extra: toJsonExtra({
        type: 'BATTLE',
        detail: {
          monster: {
            id: 'monster-giant-rat',
            name: '거대 쥐',
            hp: 0,
            atk: 3,
            spriteId: 'monster-giant-rat',
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
                itemId: 'potion-small',
                code: 'potion-healing-small',
                slot: 'consumable',
                rarity: 'common',
                quantity: 1,
              },
            ],
          },
        },
      }) as Prisma.InputJsonValue,
      extra: toJsonExtra({
        type: 'ACQUIRE_ITEM',
        detail: {
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
              slot: 'weapon',
              itemId: 'weapon-longsword',
              code: 'weapon-longsword',
            },
            unequipped: {
              slot: 'weapon',
              itemId: 'weapon-rusty-sword',
              code: 'weapon-rusty-sword',
            },
          },
          stats: { atk: 5, ap: -1 },
        },
      }) as Prisma.InputJsonValue,
      extra: toJsonExtra({
        type: 'EQUIP_ITEM',
        detail: {
          item: {
            id: 'weapon-longsword',
            code: 'weapon-longsword',
            name: 'Longsword',
            rarity: 'rare',
            modifiers: [{ stat: 'atk', value: 5 }],
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
      extra: toJsonExtra({
        type: 'BUFF_APPLIED',
        detail: {
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
      extra: toJsonExtra({
        type: 'BUFF_EXPIRED',
        detail: {
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
      extra: toJsonExtra({
        type: 'DEATH',
        detail: {
          cause: 'TRAP_SPIKE',
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
          rewards: { skillPoints: 1 },
        },
      }) as Prisma.InputJsonValue,
      extra: toJsonExtra({
        type: 'LEVEL_UP',
        detail: {
          previousLevel: 2,
          currentLevel: 3,
          threshold: 120,
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
