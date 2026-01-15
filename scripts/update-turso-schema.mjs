// Script to update Turso database schema
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://bbqtest-kunikun.aws-us-west-2.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgyNTQ5NDIsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0.KSdizD28gjbcZiAjX7KOywhPusSQcPcLDd89ovltYNQX9y2tKakH83Dwxv-iR9JnP5mqOWFGZIT5afP3n6obBA"
});

async function updateSchema() {
  console.log('Connecting to Turso...');
  
  try {
    // Check current Store table structure
    const tables = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='Store'");
    console.log('Current Store table:', tables.rows[0]?.sql || 'NOT FOUND');
    
    // If Store table doesn't have country column, add it
    if (tables.rows[0]) {
      const tableSql = String(tables.rows[0].sql);
      if (!tableSql.includes('"country"')) {
        console.log('Adding country column to Store table...');
        await client.execute("ALTER TABLE Store ADD COLUMN country TEXT NOT NULL DEFAULT 'CA'");
        console.log('Country column added!');
      } else {
        console.log('Country column already exists');
      }
    } else {
      console.log('Store table not found, you may need to run full migration');
    }
    
    // List all tables
    const allTables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log('\nAll tables in database:');
    allTables.rows.forEach(row => console.log(' -', row.name));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

updateSchema();
