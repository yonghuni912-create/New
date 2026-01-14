import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create Countries
  await prisma.country.upsert({
    where: { code: 'US' },
    update: {},
    create: {
      code: 'US',
      name: 'United States',
      currency: 'USD',
      timezone: 'America/New_York',
    },
  });

  await prisma.country.upsert({
    where: { code: 'CA' },
    update: {},
    create: {
      code: 'CA',
      name: 'Canada',
      currency: 'CAD',
      timezone: 'America/Toronto',
    },
  });

  console.log('Created countries');

  // Create Users
  const adminPassword = await hash('admin123', 10);
  const pmPassword = await hash('pm123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@bbq.com' },
    update: {},
    create: {
      email: 'admin@bbq.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'pm@bbq.com' },
    update: {},
    create: {
      email: 'pm@bbq.com',
      password: pmPassword,
      name: 'Project Manager',
      role: 'PM',
    },
  });

  console.log('Created users');
  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });