import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  const TOTAL_GROUP_MATCHES = 72;

  const predictions = await prisma.matchPrediction.findMany({
    where: { matchNumber: { gt: TOTAL_GROUP_MATCHES } },
    include: { user: { select: { name: true, email: true } } },
  });

  console.log(`Found ${predictions.length} knockout predictions.`);

  if (predictions.length > 0) {
    const backupPath = join(__dirname, `knockout-backup-${Date.now()}.json`);
    writeFileSync(backupPath, JSON.stringify(predictions, null, 2));
    console.log(`Backup saved to: ${backupPath}`);

    await prisma.matchPrediction.deleteMany({
      where: { matchNumber: { gt: TOTAL_GROUP_MATCHES } },
    });
    console.log(`Deleted ${predictions.length} knockout predictions.`);
  } else {
    console.log('Nothing to delete.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
