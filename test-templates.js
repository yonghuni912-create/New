const { PrismaClient } = require('@prisma/client');

async function test() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing LaunchTaskTemplate query...');
    
    const templates = await prisma.launchTaskTemplate.findMany({
      where: { templateName: 'DEFAULT', isActive: true },
      take: 5,
      orderBy: { orderIndex: 'asc' }
    });
    
    console.log(`Found ${templates.length} templates`);
    templates.forEach(t => {
      console.log(`  ${t.orderIndex}. ${t.title} (${t.category})`);
    });
    
    // Test with openDate
    if (templates.length > 0) {
      const { generateLaunchTasks } = require('./lib/scheduling');
      const openDate = new Date('2026-04-15');
      const tasks = generateLaunchTasks(openDate, templates);
      console.log(`\nGenerated ${tasks.length} tasks from ${templates.length} templates`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
