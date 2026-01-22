import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const ingredientCount = await prisma.ingredientMaster.count();
    const priceTemplateItemCount = await prisma.priceTemplateItem.count();
    const menuManualCount = await prisma.menuManual.count();
    const userCount = await prisma.user.count();
    const priceTemplateCount = await prisma.priceTemplate.count();
    
    console.log('=== Database Status ===');
    console.log('IngredientMasters:', ingredientCount);
    console.log('PriceTemplateItems:', priceTemplateItemCount);
    console.log('MenuManuals:', menuManualCount);
    console.log('Users:', userCount);
    console.log('PriceTemplates:', priceTemplateCount);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
