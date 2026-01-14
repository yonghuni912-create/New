import { createClient } from '@libsql/client';
import { hash } from 'bcryptjs';

const client = createClient({
  url: 'libsql://bbqtest-kunikun.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Njg0MTI1ODQsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0.7IEchSW2WRm6BOKSND4EtMbTN19FSboqTBjmo2A9RB8q4CUFnZueQUOsxU1PRzXTjH_-n97D5iT5vEkfsFScAg',
});

function generateId() {
  return 'c' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function main() {
  console.log('Seeding Turso database...');
  
  try {
    const now = new Date().toISOString();
    
    // Create Countries
    console.log('Creating countries...');
    const usId = generateId();
    const krId = generateId();
    const cnId = generateId();
    
    await client.execute({
      sql: `INSERT OR REPLACE INTO Country (id, code, name, region, currency, timezone, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [usId, 'US', 'United States', 'North America', 'USD', 'America/New_York', now, now]
    });
    await client.execute({
      sql: `INSERT OR REPLACE INTO Country (id, code, name, region, currency, timezone, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [krId, 'KR', 'South Korea', 'Asia', 'KRW', 'Asia/Seoul', now, now]
    });
    await client.execute({
      sql: `INSERT OR REPLACE INTO Country (id, code, name, region, currency, timezone, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [cnId, 'CN', 'China', 'Asia', 'CNY', 'Asia/Shanghai', now, now]
    });
    console.log('Countries created!');
    
    // Create Users
    console.log('Creating users...');
    const adminPassword = await hash('admin123', 10);
    const pmPassword = await hash('pm123', 10);
    const userPassword = await hash('user123', 10);
    
    const adminId = generateId();
    const pmId = generateId();
    const userId = generateId();
    
    await client.execute({
      sql: `INSERT OR REPLACE INTO User (id, email, password, name, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [adminId, 'admin@bbq.com', adminPassword, 'Admin User', 'ADMIN', now, now]
    });
    await client.execute({
      sql: `INSERT OR REPLACE INTO User (id, email, password, name, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [pmId, 'pm@bbq.com', pmPassword, 'Project Manager', 'PM', now, now]
    });
    await client.execute({
      sql: `INSERT OR REPLACE INTO User (id, email, password, name, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, 'user@bbq.com', userPassword, 'Regular User', 'CONTRIBUTOR', now, now]
    });
    console.log('Users created!');
    
    // Create Template
    console.log('Creating template...');
    const templateId = generateId();
    await client.execute({
      sql: `INSERT OR REPLACE INTO Template (id, name, description, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [templateId, 'Standard Store Opening', 'Standard template for new store openings', 1, now, now]
    });
    console.log('Template created!');
    
    // Create Template Phases
    console.log('Creating template phases...');
    const phase1Id = generateId();
    const phase2Id = generateId();
    const phase3Id = generateId();
    const phase4Id = generateId();
    
    await client.execute({
      sql: `INSERT INTO TemplatePhase (id, templateId, name, description, orderIndex, durationDays, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [phase1Id, templateId, 'Planning', 'Initial planning and site selection', 0, 14, now, now]
    });
    await client.execute({
      sql: `INSERT INTO TemplatePhase (id, templateId, name, description, orderIndex, durationDays, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [phase2Id, templateId, 'Construction', 'Store construction and setup', 1, 30, now, now]
    });
    await client.execute({
      sql: `INSERT INTO TemplatePhase (id, templateId, name, description, orderIndex, durationDays, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [phase3Id, templateId, 'Training', 'Staff training and preparation', 2, 14, now, now]
    });
    await client.execute({
      sql: `INSERT INTO TemplatePhase (id, templateId, name, description, orderIndex, durationDays, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [phase4Id, templateId, 'Launch', 'Final preparations and grand opening', 3, 7, now, now]
    });
    console.log('Template phases created!');
    
    // Verify data
    const users = await client.execute("SELECT email, name, role FROM User");
    console.log('\nUsers in database:', users.rows);
    
    const countries = await client.execute("SELECT code, name FROM Country");
    console.log('Countries:', countries.rows);
    
    console.log('\nSeed completed successfully!');
    
  } catch (error: any) {
    console.error('Error:', error);
  }
}

main();
