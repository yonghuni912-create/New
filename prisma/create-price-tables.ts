/**
 * Create PriceTemplate tables in Turso
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });

async function createTables() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  console.log('📦 Creating PriceTemplate tables...');

  try {
    // Create PriceTemplate table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS PriceTemplate (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        country TEXT NOT NULL,
        region TEXT,
        currency TEXT DEFAULT 'CAD',
        description TEXT,
        isActive BOOLEAN DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ PriceTemplate table created');

    // Create PriceTemplateItem table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS PriceTemplateItem (
        id TEXT PRIMARY KEY,
        priceTemplateId TEXT NOT NULL,
        ingredientMasterId TEXT NOT NULL,
        unitPrice REAL DEFAULT 0,
        packagingUnit TEXT,
        packagingQty REAL,
        notes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (priceTemplateId) REFERENCES PriceTemplate(id) ON DELETE CASCADE,
        FOREIGN KEY (ingredientMasterId) REFERENCES IngredientMaster(id) ON DELETE CASCADE,
        UNIQUE(priceTemplateId, ingredientMasterId)
      )
    `);
    console.log('✅ PriceTemplateItem table created');

    // Add priceTemplateId column to MenuManual if not exists
    try {
      await db.execute(`ALTER TABLE MenuManual ADD COLUMN priceTemplateId TEXT`);
      console.log('✅ Added priceTemplateId to MenuManual');
    } catch (e: any) {
      if (e.message.includes('duplicate column')) {
        console.log('ℹ️ priceTemplateId column already exists in MenuManual');
      } else {
        console.log('⚠️ Could not add priceTemplateId:', e.message);
      }
    }

    // Verify tables
    const tables = await db.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name IN ('PriceTemplate', 'PriceTemplateItem')
    `);
    console.log('\n📋 Created tables:', tables.rows.map(r => r.name));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

createTables()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
