// Run with: npx tsx scripts/create-admin.ts
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'admin@wk2026.be';
  const password = process.argv[3] || 'admin123';
  const name = process.argv[4] || 'Admin';

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { isAdmin: true, password: hashed },
    create: { email, password: hashed, name, isAdmin: true },
  });

  console.log(`Admin account aangemaakt/bijgewerkt:`);
  console.log(`  Email: ${email}`);
  console.log(`  Wachtwoord: ${password}`);
  console.log(`  ID: ${user.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
