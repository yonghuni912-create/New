// Script to seed LaunchTaskTemplate from Mexico City launch schedule Excel
import { createClient } from '@libsql/client';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://bbqtest-kunikun.aws-us-west-2.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgyNTQ5NDIsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0.KSdizD28gjbcZiAjX7KOywhPusSQcPcLDd89ovltYNQX9y2tKakH83Dwxv-iR9JnP5mqOWFGZIT5afP3n6obBA"
});

// Generate CUID-like ID
function generateId() {
  return 'c' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function seedLaunchTemplates() {
  console.log('Reading Excel file...');
  
  // Read Excel file
  const excelPath = path.resolve('C:/Users/kunbb/OneDrive/기본/바탕 화면/260206 멕시코 시티 런칭 스케쥴.xlsx');
  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets['세부 런칭 스케줄'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  console.log(`Total rows in sheet: ${data.length}`);
  
  // Parse tasks from row 12 onwards
  const tasks = [];
  let currentCategory = '';
  let currentSubcategory = '';
  
  for (let i = 12; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[1] || !row[4]) continue; // Skip rows without No. or Title
    
    const orderIndex = parseInt(row[1]) || tasks.length + 1;
    
    // Update category if present
    if (row[2] && row[2].toString().trim()) {
      currentCategory = row[2].toString().trim();
    }
    
    // Update subcategory if present
    if (row[3] && row[3].toString().trim()) {
      currentSubcategory = row[3].toString().trim();
    }
    
    const title = row[4].toString().trim();
    const durationDays = parseInt(row[5]) || 1;
    
    // Column 7 (index 7) is "Task Start" which represents days before opening (D-day)
    // Positive values = before open date, negative = after open date
    const daysBeforeOpening = parseInt(row[7]) || 0;
    
    tasks.push({
      id: generateId(),
      orderIndex,
      category: currentCategory,
      subcategory: currentSubcategory,
      title,
      durationDays,
      daysBeforeOpening,
      templateName: 'DEFAULT',
      isActive: 1
    });
  }
  
  console.log(`Parsed ${tasks.length} tasks from Excel`);
  
  // Sample output
  console.log('\nFirst 10 tasks:');
  tasks.slice(0, 10).forEach(t => {
    console.log(`  ${t.orderIndex}. [${t.category}/${t.subcategory}] ${t.title} (${t.durationDays}d, D-${t.daysBeforeOpening})`);
  });
  
  console.log('\nConnecting to Turso...');
  
  try {
    // Clear existing templates
    console.log('Clearing existing DEFAULT templates...');
    await client.execute("DELETE FROM LaunchTaskTemplate WHERE templateName = 'DEFAULT'");
    
    // Insert new templates
    console.log(`Inserting ${tasks.length} templates...`);
    
    for (const task of tasks) {
      await client.execute({
        sql: `INSERT INTO LaunchTaskTemplate (id, orderIndex, category, subcategory, title, durationDays, daysBeforeOpening, templateName, isActive, createdAt, updatedAt) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        args: [
          task.id,
          task.orderIndex,
          task.category,
          task.subcategory || null,
          task.title,
          task.durationDays,
          task.daysBeforeOpening,
          task.templateName,
          task.isActive
        ]
      });
    }
    
    console.log('✅ Successfully seeded LaunchTaskTemplate table!');
    
    // Verify count
    const countResult = await client.execute("SELECT COUNT(*) as count FROM LaunchTaskTemplate WHERE templateName = 'DEFAULT'");
    console.log(`Total templates in Turso: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

seedLaunchTemplates();
