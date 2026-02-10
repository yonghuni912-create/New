// Script to seed LaunchTaskTemplate to local SQLite from Mexico City launch schedule Excel
import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

async function seedLocalTemplates() {
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
    if (!row || !row[1] || !row[4]) continue;
    
    const orderIndex = parseInt(row[1]) || tasks.length + 1;
    
    if (row[2] && row[2].toString().trim()) {
      currentCategory = row[2].toString().trim();
    }
    
    if (row[3] && row[3].toString().trim()) {
      currentSubcategory = row[3].toString().trim();
    }
    
    const title = row[4].toString().trim();
    const durationDays = parseInt(row[5]) || 1;
    const daysBeforeOpening = parseInt(row[7]) || 0;
    
    tasks.push({
      orderIndex,
      category: currentCategory,
      subcategory: currentSubcategory || null,
      title,
      durationDays,
      daysBeforeOpening,
      templateName: 'DEFAULT',
      isActive: true
    });
  }
  
  console.log(`Parsed ${tasks.length} tasks from Excel`);
  
  try {
    // Clear existing templates
    console.log('Clearing existing DEFAULT templates...');
    await prisma.launchTaskTemplate.deleteMany({
      where: { templateName: 'DEFAULT' }
    });
    
    // Insert new templates
    console.log(`Inserting ${tasks.length} templates...`);
    
    await prisma.launchTaskTemplate.createMany({
      data: tasks
    });
    
    console.log('✅ Successfully seeded LaunchTaskTemplate to local SQLite!');
    
    // Verify count
    const count = await prisma.launchTaskTemplate.count({
      where: { templateName: 'DEFAULT' }
    });
    console.log(`Total templates in local DB: ${count}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedLocalTemplates();
