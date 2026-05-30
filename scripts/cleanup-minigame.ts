// Run with: npx tsx scripts/cleanup-minigame.ts [naam]
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MAX_SCORE = 200;

async function main() {
  const targetName = process.argv[2];

  if (targetName) {
    const user = await prisma.user.findFirst({
      where: { name: { contains: targetName, mode: 'insensitive' } },
    });

    if (!user) {
      console.log(`Gebruiker "${targetName}" niet gevonden.`);
      return;
    }

    const scores = await prisma.minigameScore.findMany({
      where: { userId: user.id },
      orderBy: { score: 'desc' },
    });

    console.log(`Scores van ${user.name}:`);
    for (const s of scores) {
      console.log(`  ${s.score} (${s.createdAt.toISOString()})`);
    }

    const deleted = await prisma.minigameScore.deleteMany({
      where: { userId: user.id },
    });

    console.log(`\n${deleted.count} score(s) van ${user.name} verwijderd.`);
    return;
  }

  const cheated = await prisma.minigameScore.findMany({
    where: { score: { gt: MAX_SCORE } },
    include: { user: { select: { name: true } } },
    orderBy: { score: 'desc' },
  });

  if (cheated.length === 0) {
    console.log('Geen valse scores gevonden.');
    return;
  }

  console.log(`Valse scores gevonden:`);
  for (const s of cheated) {
    console.log(`  ${s.user.name}: ${s.score} (${s.createdAt.toISOString()})`);
  }

  const deleted = await prisma.minigameScore.deleteMany({
    where: { score: { gt: MAX_SCORE } },
  });

  console.log(`\n${deleted.count} score(s) verwijderd.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
