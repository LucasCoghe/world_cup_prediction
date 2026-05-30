import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { name: true } });
  users.forEach(u => console.log(u.name));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
