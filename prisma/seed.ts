import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import { UserRole, StoreStatus, TaskStatus, TaskPriority } from '@/lib/enums';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create Countries
  const countries = await Promise.all([
    prisma.country.upsert({
      where: { code: 'US' },
      update: {},
      create: {
        code: 'US',
        name: 'United States',
        region: 'North America',
        currency: 'USD',
        timezone: 'America/New_York',
      },
    }),
    prisma.country.upsert({
      where: { code: 'KR' },
      update: {},
      create: {
        code: 'KR',
        name: 'South Korea',
        region: 'Asia',
        currency: 'KRW',
        timezone: 'Asia/Seoul',
      },
    }),
    prisma.country.upsert({
      where: { code: 'CN' },
      update: {},
      create: {
        code: 'CN',
        name: 'China',
        region: 'Asia',
        currency: 'CNY',
        timezone: 'Asia/Shanghai',
      },
    }),
  ]);

  console.log('Created countries:', countries.length);

  // Create Users
  const adminPassword = await hash('admin123', 10);
  const pmPassword = await hash('pm123', 10);
  const userPassword = await hash('user123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@bbq.com' },
    update: {},
    create: {
      email: 'admin@bbq.com',
      password: adminPassword,
      name: 'Admin User',
      role: UserRole.ADMIN,
    },
  });

  const pm = await prisma.user.upsert({
    where: { email: 'pm@bbq.com' },
    update: {},
    create: {
      email: 'pm@bbq.com',
      password: pmPassword,
      name: 'Project Manager',
      role: UserRole.PM,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@bbq.com' },
    update: {},
    create: {
      email: 'user@bbq.com',
      password: userPassword,
      name: 'Regular User',
      role: UserRole.CONTRIBUTOR,
    },
  });

  console.log('Created users:', [admin, pm, user].length);

  // Create Template
  const template = await prisma.template.upsert({
    where: { name: 'Standard Store Opening' },
    update: {},
    create: {
      name: 'Standard Store Opening',
      description: 'Standard template for new store openings',
      isActive: true,
    },
  });

  const phases = await Promise.all([
    prisma.templatePhase.create({
      data: {
        templateId: template.id,
        name: 'Pre-Opening',
        description: 'Initial setup and planning',
        order: 1,
      },
    }),
    prisma.templatePhase.create({
      data: {
        templateId: template.id,
        name: 'Construction',
        description: 'Build-out and renovation',
        order: 2,
      },
    }),
    prisma.templatePhase.create({
      data: {
        templateId: template.id,
        name: 'Training',
        description: 'Staff training and preparation',
        order: 3,
      },
    }),
    prisma.templatePhase.create({
      data: {
        templateId: template.id,
        name: 'Launch',
        description: 'Final preparations and opening',
        order: 4,
      },
    }),
  ]);

  console.log('Created template phases:', phases.length);

  // Create Template Tasks
  const templateTasks = await Promise.all([
    prisma.templateTask.create({
      data: {
        phaseId: phases[0].id,
        title: 'Site Selection',
        description: 'Identify and secure location',
        priority: TaskPriority.HIGH,
        estimatedHours: 40,
        offsetDays: -90,
        order: 1,
      },
    }),
    prisma.templateTask.create({
      data: {
        phaseId: phases[0].id,
        title: 'Lease Negotiation',
        description: 'Negotiate and sign lease',
        priority: TaskPriority.HIGH,
        estimatedHours: 20,
        offsetDays: -80,
        order: 2,
      },
    }),
    prisma.templateTask.create({
      data: {
        phaseId: phases[1].id,
        title: 'Obtain Permits',
        description: 'Get necessary building permits',
        priority: TaskPriority.URGENT,
        estimatedHours: 30,
        offsetDays: -70,
        order: 1,
      },
    }),
    prisma.templateTask.create({
      data: {
        phaseId: phases[1].id,
        title: 'Construction',
        description: 'Complete build-out',
        priority: TaskPriority.HIGH,
        estimatedHours: 200,
        offsetDays: -60,
        order: 2,
      },
    }),
    prisma.templateTask.create({
      data: {
        phaseId: phases[2].id,
        title: 'Hire Staff',
        description: 'Recruit and hire team',
        priority: TaskPriority.HIGH,
        estimatedHours: 40,
        offsetDays: -30,
        order: 1,
      },
    }),
    prisma.templateTask.create({
      data: {
        phaseId: phases[2].id,
        title: 'Staff Training',
        description: 'Conduct training sessions',
        priority: TaskPriority.MEDIUM,
        estimatedHours: 80,
        offsetDays: -20,
        order: 2,
      },
    }),
    prisma.templateTask.create({
      data: {
        phaseId: phases[3].id,
        title: 'Final Inspection',
        description: 'Complete health and safety inspection',
        priority: TaskPriority.URGENT,
        estimatedHours: 8,
        offsetDays: -7,
        order: 1,
      },
    }),
    prisma.templateTask.create({
      data: {
        phaseId: phases[3].id,
        title: 'Grand Opening',
        description: 'Launch store and marketing campaign',
        priority: TaskPriority.URGENT,
        estimatedHours: 16,
        offsetDays: 0,
        order: 2,
      },
    }),
  ]);

  console.log('Created template tasks:', templateTasks.length);

  // Create Sample Stores
  const store1 = await prisma.store.create({
    data: {
      storeCode: 'BBQ-US-001',
      storeName: 'BBQ Manhattan Downtown',
      countryId: countries[0].id,
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      franchiseeEmail: 'owner1@example.com',
      franchiseeName: 'John Smith',
      franchiseePhone: '+1-555-0101',
      status: StoreStatus.IN_PROGRESS,
      plannedOpenDate: new Date('2026-03-15'),
      estimatedRevenue: 500000,
      initialInvestment: 300000,
      notes: 'Prime location in downtown Manhattan',
    },
  });

  const store2 = await prisma.store.create({
    data: {
      storeCode: 'BBQ-KR-001',
      storeName: 'BBQ Seoul Gangnam',
      countryId: countries[1].id,
      address: '456 Gangnam-daero',
      city: 'Seoul',
      state: 'Seoul',
      postalCode: '06234',
      franchiseeEmail: 'owner2@example.com',
      franchiseeName: 'Kim Min-jun',
      franchiseePhone: '+82-2-555-0102',
      status: StoreStatus.PLANNING,
      plannedOpenDate: new Date('2026-04-20'),
      estimatedRevenue: 600000,
      initialInvestment: 250000,
      notes: 'High-traffic area in Gangnam',
    },
  });

  console.log('Created stores:', [store1, store2].length);

  // Create Tasks for Store 1
  const tasksStore1 = await Promise.all([
    prisma.task.create({
      data: {
        storeId: store1.id,
        title: 'Site Selection',
        description: 'Identify and secure location',
        phase: 'Pre-Opening',
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        assigneeId: pm.id,
        startDate: new Date('2025-12-15'),
        dueDate: new Date('2026-01-15'),
        completedAt: new Date('2026-01-10'),
      },
    }),
    prisma.task.create({
      data: {
        storeId: store1.id,
        title: 'Lease Negotiation',
        description: 'Negotiate and sign lease',
        phase: 'Pre-Opening',
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        assigneeId: admin.id,
        startDate: new Date('2026-01-10'),
        dueDate: new Date('2026-01-25'),
        completedAt: new Date('2026-01-20'),
      },
    }),
    prisma.task.create({
      data: {
        storeId: store1.id,
        title: 'Obtain Permits',
        description: 'Get necessary building permits',
        phase: 'Construction',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.URGENT,
        assigneeId: user.id,
        startDate: new Date('2026-01-20'),
        dueDate: new Date('2026-02-05'),
      },
    }),
    prisma.task.create({
      data: {
        storeId: store1.id,
        title: 'Construction',
        description: 'Complete build-out',
        phase: 'Construction',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        assigneeId: pm.id,
        startDate: new Date('2026-02-05'),
        dueDate: new Date('2026-03-01'),
      },
    }),
  ]);

  console.log('Created tasks for store 1:', tasksStore1.length);

  // Create Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        title: 'New Store Created',
        message: 'BBQ Manhattan Downtown has been added to the system',
        type: 'info',
        link: `/dashboard/stores/${store1.id}`,
      },
      {
        userId: pm.id,
        title: 'Task Assigned',
        message: 'You have been assigned to "Construction" task',
        type: 'info',
        link: `/dashboard/stores/${store1.id}`,
      },
    ],
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
