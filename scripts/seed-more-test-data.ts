// Run with: npx tsx scripts/seed-more-test-data.ts
// Adds results for matches 2 & 3 (June 12) so we get a full second matchday
// Plus varied predictions to test schandpaal, streaks, MVP/bankzitter
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ where: { isAdmin: false }, orderBy: { name: 'asc' } });
  if (users.length < 4) {
    console.log('Run seed-test-data.ts first!');
    return;
  }

  console.log('Users:', users.map(u => u.name).join(', '));

  // Match 2: KOR vs CZE (June 12) - actual: 1-2 (Tsjechie wint)
  // Match 3: CAN vs BIH (June 12) - actual: 0-0 (gelijk)
  const results = [
    { matchNumber: 2, homeScore: 1, awayScore: 2 },
    { matchNumber: 3, homeScore: 0, awayScore: 0 },
  ];

  for (const r of results) {
    await prisma.actualResult.upsert({
      where: { matchNumber: r.matchNumber },
      update: { homeScore: r.homeScore, awayScore: r.awayScore },
      create: r,
    });
  }
  console.log('\nResultaten:');
  console.log('  Match 2: KOR 1-2 CZE');
  console.log('  Match 3: CAN 0-0 BIH');

  // Predictions per user for matches 2 & 3
  // [Jansen, Pansen, DeAnsen, Ansen Jr.]
  const preds = [
    // Match 2: KOR vs CZE (actual 1-2)
    { matchNumber: 2, scores: [
      { h: 1, a: 2 },  // Jansen: EXACT! +3
      { h: 2, a: 0 },  // Pansen: fout (2nd miss in a row)
      { h: 0, a: 5 },  // DeAnsen: CZE wint maar 0-5?! Schandpaal! +1
      { h: 1, a: 1 },  // Ansen Jr: fout
    ]},
    // Match 3: CAN vs BIH (actual 0-0)
    { matchNumber: 3, scores: [
      { h: 1, a: 1 },  // Jansen: gelijk = juist +1
      { h: 3, a: 0 },  // Pansen: fout (3rd miss in a row = BIER!)
      { h: 5, a: 0 },  // DeAnsen: 5-0?! Schandpaal! (3rd miss = BIER!)
      { h: 0, a: 0 },  // Ansen Jr: EXACT! +3
    ]},
  ];

  for (const match of preds) {
    for (let i = 0; i < users.length; i++) {
      await prisma.matchPrediction.upsert({
        where: { userId_matchNumber: { userId: users[i].id, matchNumber: match.matchNumber } },
        update: { homeScore: match.scores[i].h, awayScore: match.scores[i].a },
        create: {
          userId: users[i].id,
          matchNumber: match.matchNumber,
          homeScore: match.scores[i].h,
          awayScore: match.scores[i].a,
        },
      });
    }
  }

  console.log('\nVoorspellingen match 2 (KOR vs CZE, werkelijk 1-2):');
  console.log('  Jansen:    1-2 EXACT! (+3)');
  console.log('  Pansen:    2-0 fout (2e mis op rij)');
  console.log('  DeAnsen:   0-5 fout maar juiste winnaar (+1) - SCHANDPAAL!');
  console.log('  Ansen Jr:  1-1 fout');

  console.log('\nVoorspellingen match 3 (CAN vs BIH, werkelijk 0-0):');
  console.log('  Jansen:    1-1 juist uitkomst (+1)');
  console.log('  Pansen:    3-0 fout (3e op rij = STRAFBIER!)');
  console.log('  DeAnsen:   5-0 fout (3e op rij = STRAFBIER!) - SCHANDPAAL!');
  console.log('  Ansen Jr:  0-0 EXACT! (+3)');

  console.log('\n=== VERWACHT NA 2 SPEELDAGEN ===');
  console.log('Totaalstand:');
  console.log('  Jansen:    3+3+1 = 7 punten');
  console.log('  Ansen Jr:  1+0+3 = 4 punten');
  console.log('  DeAnsen:   0+1+0 = 1 punt');
  console.log('  Pansen:    0+0+0 = 0 punten');
  console.log('\nBiertjes:');
  console.log('  Pansen:    2 (1x laatste na dag 1 + 1x beschamende reeks)');
  console.log('  DeAnsen:   2 (1x laatste na dag 1 + 1x beschamende reeks)');
  console.log('\nSchandpaal:');
  console.log('  DeAnsen: CAN 5-0 BIH (was 0-0) shame=5');
  console.log('  DeAnsen: KOR 0-5 CZE (was 1-2) shame=4');
  console.log('  Pansen: CAN 3-0 BIH (was 0-0) shame=3');
  console.log('\nMVP/Bankzitter:');
  console.log('  Dag 1 (11 jun): MVP=Jansen(3), Bankzitter=Pansen(0) of DeAnsen(0)');
  console.log('  Dag 2 (12 jun): MVP=Jansen(4), Bankzitter=Pansen(0)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
