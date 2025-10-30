import {
  PrismaClient,
  Prisma,
  DungeonLogCategory,
  DungeonLogAction,
  DungeonLogStatus,
} from '@prisma/client';

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

  const baseTime = new Date();

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
      delta: { ap: -1 } as Prisma.InputJsonValue,
      extra: {
        type: 'battle',
        monster: {
          id: 'monster-giant-rat',
          name: '거대 쥐',
          hp: 24,
          atk: 3,
          spriteId: 'monster-giant-rat',
        },
      } as Prisma.InputJsonValue,
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
      delta: { hp: -5, ap: -1, gold: 35 } as Prisma.InputJsonValue,
      extra: {
        type: 'battle',
        result: 'VICTORY',
        monster: {
          id: 'monster-giant-rat',
          name: '거대 쥐',
          hp: 0,
          atk: 3,
          spriteId: 'monster-giant-rat',
        },
      } as Prisma.InputJsonValue,
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
      delta: {
        inventory: {
          added: [
            {
              itemId: 'potion-small',
              slot: 'consumable',
              rarity: 'common',
              quantity: 1,
            },
          ],
        },
      } as Prisma.InputJsonValue,
      extra: {
        reward: {
          source: 'battle-drop',
        },
      } as Prisma.InputJsonValue,
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
      delta: {
        inventory: {
          equipped: { slot: 'weapon', itemId: 'weapon-longsword' },
          unequipped: { slot: 'weapon', itemId: 'weapon-rusty-sword' },
        },
        stats: { atk: 5, ap: -1 },
      } as Prisma.InputJsonValue,
      extra: {
        item: {
          id: 'weapon-longsword',
          name: 'Longsword',
          rarity: 'rare',
          modifiers: [{ stat: 'atk', value: 5 }],
        },
      } as Prisma.InputJsonValue,
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
      delta: {
        buffs: {
          applied: [
            {
              buffId: 'angel-ring-resurrection',
              totalTurns: null,
              remainingTurns: null,
              source: 'angel-ring',
            },
          ],
        },
      } as Prisma.InputJsonValue,
      extra: {
        buff: {
          id: 'angel-ring-resurrection',
          name: '천사의 가호',
          effect: 'HP가 0이 되면 한 번 부활',
          spriteId: 'buff-angel-ring',
        },
      } as Prisma.InputJsonValue,
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
      delta: {
        buffs: {
          expired: [
            {
              buffId: 'angel-ring-resurrection',
              expiredAtTurn: 205,
            },
          ],
        },
        stats: { hp: 10 },
      } as Prisma.InputJsonValue,
      extra: {
        buff: {
          id: 'angel-ring-resurrection',
          consumedBy: 'resurrection',
        },
      } as Prisma.InputJsonValue,
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
      delta: {
        stats: { hp: 20 },
        progress: { floor: 1, floorProgress: 0 },
      } as Prisma.InputJsonValue,
      extra: {
        death: {
          cause: 'TRAP_SPIKE',
          handledBy: 'resurrection',
        },
      } as Prisma.InputJsonValue,
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
      delta: {
        stats: { level: 3, maxHp: 24, atk: 2 },
        rewards: { skillPoints: 1 },
      } as Prisma.InputJsonValue,
      extra: {
        levelUp: {
          previousLevel: 2,
          currentLevel: 3,
          threshold: 120,
        },
      } as Prisma.InputJsonValue,
      createdAt: new Date(baseTime.getTime() - 1000 * 30),
    },
  ];

  for (const log of logs) {
    await prisma.dungeonLog.create({ data: log });
  }

  console.info('Seeded user:', user.email);
  console.info('Seeded dungeon state for:', user.email);
  console.info('Seeded dungeon logs:', logs.length);
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
