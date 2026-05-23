// Run with: npx tsx scripts/cleanup-test-data.ts
// Removes ALL non-admin users, their predictions, comments, and all actual results
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const nonAdminUsers = await prisma.user.findMany({
    where: { isAdmin: false },
    select: { id: true, email: true, name: true },
  });

  console.log(`Gevonden: ${nonAdminUsers.length} niet-admin gebruikers:`);
  for (const u of nonAdminUsers) {
    console.log(`  - ${u.name} (${u.email})`);
  }

  const userIds = nonAdminUsers.map(u => u.id);

  const delComments = await prisma.matchComment.deleteMany({ where: { userId: { in: userIds } } });
  const delPreds = await prisma.matchPrediction.deleteMany({ where: { userId: { in: userIds } } });
  const delExtra = await prisma.extraPrediction.deleteMany({ where: { userId: { in: userIds } } });
  const delUsers = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  const delResults = await prisma.actualResult.deleteMany({});

  console.log(`\nVerwijderd:`);
  console.log(`  ${delUsers.count} gebruikers`);
  console.log(`  ${delPreds.count} voorspellingen`);
  console.log(`  ${delExtra.count} extra voorspellingen`);
  console.log(`  ${delComments.count} comments`);
  console.log(`  ${delResults.count} resultaten`);
  console.log('\nDatabase is schoon! Alleen admin@wk2026.be blijft over.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
