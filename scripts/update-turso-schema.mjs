// Script to update Turso database schema
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://bbqtest-kunikun.aws-us-west-2.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgyNTQ5NDIsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0.KSdizD28gjbcZiAjX7KOywhPusSQcPcLDd89ovltYNQX9y2tKakH83Dwxv-iR9JnP5mqOWFGZIT5afP3n6obBA"
});

async function updateSchema() {
  console.log('Connecting to Turso...');
  
  try {
    // Check current ManualIngredient table structure
    const miTable = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='ManualIngredient'");
    console.log('Current ManualIngredient table:', miTable.rows[0]?.sql || 'NOT FOUND');
    
    // If ManualIngredient table doesn't have isPackage column, add it
    if (miTable.rows[0]) {
      const tableSql = String(miTable.rows[0].sql);
      if (!tableSql.includes('"isPackage"') && !tableSql.includes('isPackage')) {
        console.log('Adding isPackage column to ManualIngredient table...');
        await client.execute("ALTER TABLE ManualIngredient ADD COLUMN isPackage INTEGER NOT NULL DEFAULT 0");
        console.log('isPackage column added!');
      } else {
        console.log('isPackage column already exists');
      }
    } else {
      console.log('ManualIngredient table not found, you may need to run full migration');
    }
    
    // Check if MenuManual has version column
    const mmTable = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='MenuManual'");
    if (mmTable.rows[0]) {
      const tableSql = String(mmTable.rows[0].sql);
      if (!tableSql.includes('"version"') && !tableSql.includes('version')) {
        console.log('Adding version column to MenuManual table...');
        await client.execute("ALTER TABLE MenuManual ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
        console.log('version column added!');
      } else {
        console.log('version column already exists in MenuManual');
      }
    }
    
    // Create ManualVersion table if not exists
    const mvTable = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='ManualVersion'");
    if (!mvTable.rows[0]) {
      console.log('Creating ManualVersion table...');
      await client.execute(`
        CREATE TABLE ManualVersion (
          id TEXT PRIMARY KEY NOT NULL,
          manualId TEXT NOT NULL,
          version INTEGER NOT NULL,
          name TEXT NOT NULL,
          koreanName TEXT,
          sellingPrice REAL,
          shelfLife TEXT,
          ingredients TEXT,
          cookingMethod TEXT,
          imageUrl TEXT,
          changeNote TEXT,
          changedBy TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (manualId) REFERENCES MenuManual(id) ON DELETE CASCADE
        )
      `);
      // Create indexes
      await client.execute("CREATE INDEX IF NOT EXISTS idx_manualversion_manualid ON ManualVersion(manualId)");
      await client.execute("CREATE INDEX IF NOT EXISTS idx_manualversion_manualid_version ON ManualVersion(manualId, version)");
      console.log('ManualVersion table created!');
    } else {
      console.log('ManualVersion table already exists');
    }

    // Check if IngredientMaster has isCompound column
    const imTable = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='IngredientMaster'");
    if (imTable.rows[0]) {
      const tableSql = String(imTable.rows[0].sql);
      if (!tableSql.includes('"isCompound"') && !tableSql.includes('isCompound')) {
        console.log('Adding isCompound column to IngredientMaster table...');
        await client.execute("ALTER TABLE IngredientMaster ADD COLUMN isCompound INTEGER NOT NULL DEFAULT 0");
        console.log('isCompound column added!');
      } else {
        console.log('isCompound column already exists in IngredientMaster');
      }
    }

    // Create CompoundIngredientItem table if not exists
    const ciTable = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='CompoundIngredientItem'");
    if (!ciTable.rows[0]) {
      console.log('Creating CompoundIngredientItem table...');
      await client.execute(`
        CREATE TABLE CompoundIngredientItem (
          id TEXT PRIMARY KEY NOT NULL,
          compoundIngredientId TEXT NOT NULL,
          subIngredientId TEXT NOT NULL,
          quantity REAL NOT NULL DEFAULT 0,
          unit TEXT NOT NULL DEFAULT 'g',
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (compoundIngredientId) REFERENCES IngredientMaster(id) ON DELETE CASCADE,
          FOREIGN KEY (subIngredientId) REFERENCES IngredientMaster(id) ON DELETE CASCADE
        )
      `);
      await client.execute("CREATE INDEX IF NOT EXISTS idx_compound_ingredient_id ON CompoundIngredientItem(compoundIngredientId)");
      await client.execute("CREATE INDEX IF NOT EXISTS idx_sub_ingredient_id ON CompoundIngredientItem(subIngredientId)");
      console.log('CompoundIngredientItem table created!');
    } else {
      console.log('CompoundIngredientItem table already exists');
    }

    // Check current Store table structure
    const tables = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='Store'");
    console.log('Current Store table:', tables.rows[0]?.sql || 'NOT FOUND');
    
    // If Store table doesn't have country column, add it
    if (tables.rows[0]) {
      const tableSql = String(tables.rows[0].sql);
      if (!tableSql.includes('"country"') && !tableSql.includes(' country ') && !tableSql.includes(' country,')) {
        console.log('Adding country column to Store table...');
        try {
          await client.execute("ALTER TABLE Store ADD COLUMN country TEXT NOT NULL DEFAULT 'CA'");
          console.log('Country column added!');
        } catch (e) {
          console.log('Country column might already exist (caught error)');
        }
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
