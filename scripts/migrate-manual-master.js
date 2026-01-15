// Migration script to add isMaster and masterManualId columns to MenuManual
// Run with: node scripts/migrate-manual-master.js

const { createClient } = require('@libsql/client');

async function migrate() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  
  if (!url) {
    console.error('❌ TURSO_DATABASE_URL is required');
    process.exit(1);
  }

  console.log('🔗 Connecting to Turso...');
  console.log('   URL:', url);
  
  const client = createClient({ url, authToken });

  const alterStatements = [
    'ALTER TABLE MenuManual ADD COLUMN isMaster INTEGER DEFAULT 1',
    'ALTER TABLE MenuManual ADD COLUMN masterManualId TEXT'
  ];

  for (const sql of alterStatements) {
    try {
      await client.execute(sql);
      console.log('✅', sql);
    } catch (err) {
      if (err.message?.includes('duplicate column') || err.message?.includes('already exists')) {
        console.log('⏭️ Column already exists, skipping:', sql);
      } else {
        console.error('❌ Error:', err.message);
      }
    }
  }

  console.log('\n✅ Migration complete!');
  process.exit(0);
}

migrate();
