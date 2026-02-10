// Manual task generation script for debugging
import { createClient } from '@libsql/client';
import { randomBytes } from 'crypto';

const client = createClient({
  url: 'libsql://bbqtest-kunikun.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjkxMDkzOTIsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0._4F-rfmdARKRRjDpXXQcLinwKDcu_36IxN43HV_WrhGeBVBezu0d6qaBIxErf_juGkGqmmsMYstN59u9_5U2DA'
});

function generateId() {
  return randomBytes(12).toString('base64url').substring(0, 25);
}

function addBusinessDays(date, days) {
  let result = new Date(date);
  let remaining = Math.abs(days);
  const direction = days >= 0 ? 1 : -1;
  
  while (remaining > 0) {
    result.setDate(result.getDate() + direction);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining--;
    }
  }
  return result;
}

async function main() {
  try {
    // Get store
    const storeResult = await client.execute('SELECT id, plannedOpenDate FROM Store LIMIT 1');
    if (storeResult.rows.length === 0) {
      console.error('No store found');
      return;
    }
    
    const store = storeResult.rows[0];
    const storeId = store.id;
    const openDate = new Date(store.plannedOpenDate);
    
    console.log('Store ID:', storeId);
    console.log('Open Date:', openDate.toISOString());
    
    // Check existing tasks
    const existingTasks = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM Task WHERE storeId = ?',
      args: [storeId]
    });
    console.log('Existing tasks:', existingTasks.rows[0].count);
    
    if (existingTasks.rows[0].count > 0) {
      console.log('Tasks already exist. Deleting...');
      await client.execute({
        sql: 'DELETE FROM Task WHERE storeId = ?',
        args: [storeId]
      });
      console.log('Deleted existing tasks.');
    }
    
    // Get templates
    const templatesResult = await client.execute(
      'SELECT id, orderIndex, category, subcategory, title, durationDays, daysBeforeOpening FROM LaunchTaskTemplate WHERE templateName = ? AND isActive = 1 ORDER BY orderIndex',
      ['DEFAULT']
    );
    
    console.log('Found templates:', templatesResult.rows.length);
    
    // Generate tasks
    const now = new Date().toISOString();
    let insertCount = 0;
    
    for (const template of templatesResult.rows) {
      const dueDate = addBusinessDays(openDate, -template.daysBeforeOpening);
      const startDate = addBusinessDays(dueDate, -(template.durationDays - 1));
      
      const taskId = 'task_' + generateId();
      
      await client.execute({
        sql: `INSERT INTO Task (id, storeId, launchTemplateId, title, description, status, priority, orderIndex, category, subcategory, durationDays, daysBeforeOpening, startDate, dueDate, createdAt, updatedAt) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          taskId,
          storeId,
          template.id,
          template.title,
          template.subcategory || '',
          'TODO',
          'MEDIUM',
          template.orderIndex,
          template.category,
          template.subcategory || '',
          template.durationDays,
          template.daysBeforeOpening,
          startDate.toISOString(),
          dueDate.toISOString(),
          now,
          now
        ]
      });
      
      insertCount++;
      if (insertCount % 20 === 0) {
        console.log(`Inserted ${insertCount} tasks...`);
      }
    }
    
    console.log(`✅ Successfully inserted ${insertCount} tasks!`);
    
    // Verify
    const finalCount = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM Task WHERE storeId = ?',
      args: [storeId]
    });
    console.log('Final task count:', finalCount.rows[0].count);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
