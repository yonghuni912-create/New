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
  console.log('Recreating Turso database schema and seeding data...');
  
  try {
    const now = new Date().toISOString();
    
    // Drop and recreate Store table with correct schema
    console.log('Dropping old Store table...');
    await client.execute('DROP TABLE IF EXISTS Store');
    
    console.log('Creating new Store table with correct schema...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "Store" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "storeCode" TEXT NOT NULL UNIQUE,
        "storeName" TEXT NOT NULL,
        "countryId" TEXT NOT NULL,
        "address" TEXT,
        "city" TEXT,
        "state" TEXT,
        "postalCode" TEXT,
        "latitude" REAL,
        "longitude" REAL,
        "franchiseeEmail" TEXT,
        "franchiseeName" TEXT,
        "franchiseePhone" TEXT,
        "status" TEXT NOT NULL DEFAULT 'PLANNING',
        "plannedOpenDate" DATETIME,
        "actualOpenDate" DATETIME,
        "estimatedRevenue" REAL,
        "initialInvestment" REAL,
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "Store_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    console.log('Store table created!');
    
    // Check if countries exist, if not create them
    const existingCountries = await client.execute("SELECT id, code FROM Country");
    let usId: string, krId: string, cnId: string;
    
    if (existingCountries.rows.length === 0) {
      console.log('Creating countries...');
      usId = generateId();
      krId = generateId();
      cnId = generateId();
      
      await client.execute({
        sql: `INSERT INTO Country (id, code, name, region, currency, timezone, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [usId, 'US', 'United States', 'North America', 'USD', 'America/New_York', now, now]
      });
      await client.execute({
        sql: `INSERT INTO Country (id, code, name, region, currency, timezone, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [krId, 'KR', 'South Korea', 'Asia', 'KRW', 'Asia/Seoul', now, now]
      });
      await client.execute({
        sql: `INSERT INTO Country (id, code, name, region, currency, timezone, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [cnId, 'CN', 'China', 'Asia', 'CNY', 'Asia/Shanghai', now, now]
      });
      console.log('Countries created!');
    } else {
      console.log('Countries already exist');
      const countryMap = Object.fromEntries(existingCountries.rows.map((r: any) => [r.code, r.id]));
      usId = countryMap['US'] || generateId();
      krId = countryMap['KR'] || generateId();
      cnId = countryMap['CN'] || generateId();
    }
    
    // Check if users exist
    const existingUsers = await client.execute("SELECT email FROM User");
    if (existingUsers.rows.length === 0) {
      console.log('Creating users...');
      const adminPassword = await hash('admin123', 10);
      const pmPassword = await hash('pm123', 10);
      const userPassword = await hash('user123', 10);
      
      await client.execute({
        sql: `INSERT INTO User (id, email, password, name, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [generateId(), 'admin@bbq.com', adminPassword, 'Admin User', 'ADMIN', now, now]
      });
      await client.execute({
        sql: `INSERT INTO User (id, email, password, name, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [generateId(), 'pm@bbq.com', pmPassword, 'Project Manager', 'PM', now, now]
      });
      await client.execute({
        sql: `INSERT INTO User (id, email, password, name, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [generateId(), 'user@bbq.com', userPassword, 'Regular User', 'CONTRIBUTOR', now, now]
      });
      console.log('Users created!');
    } else {
      console.log('Users already exist');
    }
    
    // Create sample stores
    console.log('Creating sample stores...');
    const store1Id = generateId();
    const store2Id = generateId();
    
    await client.execute({
      sql: `INSERT INTO Store (id, storeCode, storeName, countryId, address, city, state, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [store1Id, 'US-NYC-001', 'BBQ Manhattan', usId, '123 Broadway', 'New York', 'NY', 'IN_PROGRESS', now, now]
    });
    await client.execute({
      sql: `INSERT INTO Store (id, storeCode, storeName, countryId, address, city, state, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [store2Id, 'KR-SEL-001', 'BBQ Gangnam', krId, '456 Gangnam-daero', 'Seoul', 'Gangnam-gu', 'PLANNING', now, now]
    });
    console.log('Stores created!');
    
    // Verify data
    const users = await client.execute("SELECT email, name, role FROM User");
    console.log('\nUsers in database:', users.rows);
    
    const countries = await client.execute("SELECT code, name FROM Country");
    console.log('Countries:', countries.rows);
    
    const stores = await client.execute("SELECT storeCode, storeName, status FROM Store");
    console.log('Stores:', stores.rows);
    
    console.log('\nSeed completed successfully!');
    
  } catch (error: any) {
    console.error('Error:', error);
  }
}

main();
