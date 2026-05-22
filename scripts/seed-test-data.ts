// Run with: npx tsx scripts/seed-test-data.ts
// Creates test users with predictions + a match result to test the beer counter
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('test123', 10);

  // Create test users (friends)
  const users = [
    { name: 'Jansen', email: 'jansen@test.be' },
    { name: 'Pansen', email: 'pansen@test.be' },
    { name: 'DeAnsen', email: 'deansen@test.be' },
    { name: 'Ansen Jr.', email: 'ansenjr@test.be' },
  ];

  const createdUsers = [];
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { email: u.email, password: hashed, name: u.name, isAdmin: false },
    });
    createdUsers.push(user);
    console.log(`User: ${u.name} (${user.id})`);
  }

  // Each user predicts match 1 (MEX vs RSA, June 11) differently
  const predictions = [
    { homeScore: 2, awayScore: 1 }, // Jansen: Mexico wint 2-1
    { homeScore: 1, awayScore: 1 }, // Pansen: gelijkspel 1-1
    { homeScore: 0, awayScore: 2 }, // De Ansen: Zuid-Afrika wint 0-2
    { homeScore: 3, awayScore: 0 }, // Ansen Jr: Mexico wint 3-0
  ];

  for (let i = 0; i < createdUsers.length; i++) {
    await prisma.matchPrediction.upsert({
      where: { userId_matchNumber: { userId: createdUsers[i].id, matchNumber: 1 } },
      update: { homeScore: predictions[i].homeScore, awayScore: predictions[i].awayScore },
      create: {
        userId: createdUsers[i].id,
        matchNumber: 1,
        homeScore: predictions[i].homeScore,
        awayScore: predictions[i].awayScore,
      },
    });
  }
  console.log('\nVoorspellingen voor match 1 (MEX vs RSA):');
  console.log('  Jansen:    2-1 (Mexico wint)');
  console.log('  Pansen:    1-1 (gelijk)');
  console.log('  De Ansen:  0-2 (Zuid-Afrika wint)');
  console.log('  Ansen Jr.: 3-0 (Mexico wint)');

  // Set actual result: Mexico wint 2-1
  await prisma.actualResult.upsert({
    where: { matchNumber: 1 },
    update: { homeScore: 2, awayScore: 1 },
    create: { matchNumber: 1, homeScore: 2, awayScore: 1 },
  });
  console.log('\nWerkelijke uitslag match 1: MEX 2-1 RSA');
  console.log('\nVerwacht resultaat:');
  console.log('  Jansen:    3 punten (juiste uitslag 2-1) -> geen bier');
  console.log('  Ansen Jr.: 1 punt (juiste uitkomst, fout score) -> geen bier');
  console.log('  Pansen:    0 punten (fout) -> BIER!');
  console.log('  De Ansen:  0 punten (fout) -> BIER!');
  console.log('\nPansen en De Ansen staan beiden laatste -> beiden een pintje!');
  console.log('\nLog in als een van de testusers met wachtwoord: test123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
