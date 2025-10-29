import { PrismaClient } from '@prisma/client';

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
      hp: 30,
      maxHp: 30,
      atk: 5,
      def: 3,
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

  console.info('Seeded user:', user.email);
  console.info('Seeded dungeon state for:', user.email);
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
