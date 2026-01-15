// Migration script to add local fields to PriceTemplateItem
// Run with: node scripts/migrate-price-template-item.js

const { createClient } = require('@libsql/client');

async function migrate() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  console.log('Adding new columns to PriceTemplateItem...');

  const alterStatements = [
    'ALTER TABLE PriceTemplateItem ADD COLUMN localEnglishName TEXT',
    'ALTER TABLE PriceTemplateItem ADD COLUMN localKoreanName TEXT',
    'ALTER TABLE PriceTemplateItem ADD COLUMN localQuantity REAL',
    'ALTER TABLE PriceTemplateItem ADD COLUMN localUnit TEXT',
    'ALTER TABLE PriceTemplateItem ADD COLUMN localYieldRate REAL',
  ];

  for (const sql of alterStatements) {
    try {
      await db.execute(sql);
      console.log(`✅ ${sql}`);
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log(`⏭️ Column already exists: ${sql}`);
      } else {
        console.error(`❌ Error: ${error.message}`);
      }
    }
  }

  console.log('Migration complete!');
}

migrate().catch(console.error);
