// Run with: npx tsx scripts/cleanup-test-data.ts
// Removes all test users, predictions, and results
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const testEmails = [
    'jansen@test.be',
    'pansen@test.be',
    'deansen@test.be',
    'ansenjr@test.be',
  ];

  const testUsers = await prisma.user.findMany({
    where: { email: { in: testEmails } },
    select: { id: true, email: true },
  });

  if (testUsers.length === 0) {
    console.log('Geen testdata gevonden.');
    return;
  }

  const userIds = testUsers.map(u => u.id);

  // Delete in order (foreign keys)
  const delPreds = await prisma.matchPrediction.deleteMany({ where: { userId: { in: userIds } } });
  const delExtra = await prisma.extraPrediction.deleteMany({ where: { userId: { in: userIds } } });
  const delUsers = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  const delResults = await prisma.actualResult.deleteMany({});

  console.log(`Verwijderd:`);
  console.log(`  ${delUsers.count} testusers`);
  console.log(`  ${delPreds.count} voorspellingen`);
  console.log(`  ${delExtra.count} extra voorspellingen`);
  console.log(`  ${delResults.count} resultaten`);
  console.log('\nDatabase is schoon voor productie!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
