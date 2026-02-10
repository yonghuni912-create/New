import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://bbqtest-kunikun.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjkxMDkzOTIsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0._4F-rfmdARKRRjDpXXQcLinwKDcu_36IxN43HV_WrhGeBVBezu0d6qaBIxErf_juGkGqmmsMYstN59u9_5U2DA'
});

async function migrate() {
  console.log('Starting Turso migration...');

  // Add parentId to TaskComment if not exists
  try {
    await client.execute('ALTER TABLE TaskComment ADD COLUMN parentId TEXT');
    console.log('✅ Added parentId to TaskComment');
  } catch (e) {
    if (e.message.includes('duplicate')) {
      console.log('ℹ️ parentId column already exists');
    } else {
      console.log('⚠️ parentId:', e.message);
    }
  }

  // Create TaskFile table
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS TaskFile (
        id TEXT PRIMARY KEY NOT NULL,
        taskId TEXT NOT NULL,
        fileName TEXT NOT NULL,
        originalName TEXT NOT NULL,
        mimeType TEXT NOT NULL,
        size INTEGER NOT NULL,
        path TEXT NOT NULL,
        uploadedById TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (taskId) REFERENCES Task(id) ON DELETE CASCADE,
        FOREIGN KEY (uploadedById) REFERENCES User(id)
      )
    `);
    console.log('✅ Created TaskFile table');
  } catch (e) {
    console.log('⚠️ TaskFile:', e.message);
  }

  // Create indexes
  try {
    await client.execute('CREATE INDEX IF NOT EXISTS TaskFile_taskId_idx ON TaskFile(taskId)');
    console.log('✅ Created TaskFile_taskId_idx');
  } catch (e) {
    console.log('⚠️ TaskFile_taskId_idx:', e.message);
  }

  try {
    await client.execute('CREATE INDEX IF NOT EXISTS TaskComment_taskId_idx ON TaskComment(taskId)');
    console.log('✅ Created TaskComment_taskId_idx');
  } catch (e) {
    console.log('⚠️ TaskComment_taskId_idx:', e.message);
  }

  try {
    await client.execute('CREATE INDEX IF NOT EXISTS TaskComment_parentId_idx ON TaskComment(parentId)');
    console.log('✅ Created TaskComment_parentId_idx');
  } catch (e) {
    console.log('⚠️ TaskComment_parentId_idx:', e.message);
  }

  // Verify
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('\nTables:', tables.rows.map(r => r.name).join(', '));

  const taskFileInfo = await client.execute('PRAGMA table_info(TaskFile)');
  console.log('\nTaskFile columns:', taskFileInfo.rows.map(r => r.name).join(', '));

  const commentInfo = await client.execute('PRAGMA table_info(TaskComment)');
  console.log('TaskComment columns:', commentInfo.rows.map(r => r.name).join(', '));

  console.log('\n✅ Migration complete!');
}

migrate().catch(console.error);
