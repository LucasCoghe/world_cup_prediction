import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const TOTAL_GROUP_MATCHES = 72;

  const count = await prisma.matchPrediction.count({
    where: { matchNumber: { gt: TOTAL_GROUP_MATCHES } },
  });

  console.log(`Found ${count} knockout predictions to delete.`);

  if (count > 0) {
    await prisma.matchPrediction.deleteMany({
      where: { matchNumber: { gt: TOTAL_GROUP_MATCHES } },
    });
    console.log(`Deleted ${count} knockout predictions.`);
  } else {
    console.log('Nothing to delete.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
