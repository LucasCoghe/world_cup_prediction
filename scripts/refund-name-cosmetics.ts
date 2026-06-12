// Run with: npx tsx scripts/refund-name-cosmetics.ts
// Refunds coins for all purchased name_color cosmetics and deletes those records.
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Prices of the removed name_color cosmetics (must match what was in COSMETICS).
const NAME_COLOR_PRICES: Record<string, number> = {
  name_silver: 200,
  name_gold: 350,
  name_fire: 550,
  name_ice: 550,
  name_matrix: 700,
  name_stars: 850,
  name_belgian: 1100,
  name_rainbow: 3500,
};

async function main() {
  const records = await prisma.userCosmetic.findMany({
    where: { category: 'name_color' },
    include: { user: { select: { name: true } } },
  });

  if (records.length === 0) {
    console.log('Geen name_color aankopen gevonden. Niets te refunden.');
    return;
  }

  const refundPerUser = new Map<string, number>();
  const unknown: string[] = [];
  for (const r of records) {
    const price = NAME_COLOR_PRICES[r.cosmeticId];
    if (price === undefined) {
      unknown.push(`${r.user.name}: ${r.cosmeticId}`);
      continue;
    }
    refundPerUser.set(r.userId, (refundPerUser.get(r.userId) || 0) + price);
  }

  if (unknown.length > 0) {
    console.log('Onbekende cosmetic IDs (geen refund, handmatig nakijken):');
    for (const u of unknown) console.log(`  ${u}`);
  }

  console.log(`\nRefund samenvatting:`);
  for (const [userId, amount] of refundPerUser) {
    const rec = records.find(r => r.userId === userId)!;
    console.log(`  ${rec.user.name}: +${amount} 🪙`);
  }

  console.log(`\nUitvoeren...`);
  await prisma.$transaction([
    ...Array.from(refundPerUser.entries()).map(([userId, amount]) =>
      prisma.user.update({
        where: { id: userId },
        data: { coinsBalance: { increment: amount } },
      })
    ),
    prisma.userCosmetic.deleteMany({ where: { category: 'name_color' } }),
  ]);

  console.log(`\nKlaar: ${records.length} record(s) verwijderd, ${refundPerUser.size} gebruiker(s) gerefund.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
