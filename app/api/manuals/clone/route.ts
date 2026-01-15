import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

// POST - Clone selected manuals to a country template
// Body: { manualIds: string[], priceTemplateId: string }
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { manualIds, priceTemplateId } = body;

    if (!manualIds || !Array.isArray(manualIds) || manualIds.length === 0) {
      return NextResponse.json({ error: 'manualIds are required' }, { status: 400 });
    }

    if (!priceTemplateId) {
      return NextResponse.json({ error: 'priceTemplateId is required' }, { status: 400 });
    }

    // Get the price template to get country name
    const priceTemplate = await prisma.priceTemplate.findUnique({
      where: { id: priceTemplateId }
    });

    if (!priceTemplate) {
      return NextResponse.json({ error: 'Price template not found' }, { status: 404 });
    }

    console.log(`📋 Cloning ${manualIds.length} manuals to template: ${priceTemplate.country}`);

    const clonedManuals = [];

    for (const manualId of manualIds) {
      // Get the original manual with ingredients
      const originalManual = await prisma.menuManual.findUnique({
        where: { id: manualId },
        include: {
          ingredients: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      });

      if (!originalManual) {
        console.log(`⚠️ Manual ${manualId} not found, skipping`);
        continue;
      }

      // Check if a copy already exists for this template
      const existingCopy = await prisma.menuManual.findFirst({
        where: {
          masterManualId: originalManual.isMaster ? originalManual.id : originalManual.masterManualId,
          priceTemplateId: priceTemplateId
        }
      });

      if (existingCopy) {
        console.log(`⏭️ Copy already exists for ${originalManual.name} in ${priceTemplate.country}, skipping`);
        clonedManuals.push(existingCopy);
        continue;
      }

      // Create a copy of the manual
      const clonedManual = await prisma.menuManual.create({
        data: {
          name: originalManual.name,
          koreanName: originalManual.koreanName,
          imageUrl: originalManual.imageUrl,
          shelfLife: originalManual.shelfLife,
          yield: originalManual.yield,
          yieldUnit: originalManual.yieldUnit,
          sellingPrice: originalManual.sellingPrice,
          notes: originalManual.notes,
          cookingMethod: originalManual.cookingMethod,
          isActive: true,
          isArchived: false,
          priceTemplateId: priceTemplateId,
          isMaster: false,
          masterManualId: originalManual.isMaster ? originalManual.id : originalManual.masterManualId,
          ingredients: originalManual.ingredients.length > 0 ? {
            create: originalManual.ingredients.map((ing, index) => ({
              ingredientId: ing.ingredientId,
              name: ing.name,
              koreanName: ing.koreanName,
              quantity: ing.quantity,
              unit: ing.unit,
              section: ing.section,
              sortOrder: index,
              notes: ing.notes
            }))
          } : undefined
        },
        include: {
          ingredients: true
        }
      });

      console.log(`✅ Cloned: ${clonedManual.name} to ${priceTemplate.country}`);
      clonedManuals.push(clonedManual);

      // Create audit log
      await createAuditLog({
        userId: (session.user as { id: string }).id,
        action: 'MANUAL_CLONE',
        entityType: 'MenuManual',
        entityId: clonedManual.id,
        newValue: { 
          originalId: manualId, 
          country: priceTemplate.country,
          priceTemplateId 
        }
      });
    }

    return NextResponse.json({
      success: true,
      clonedCount: clonedManuals.length,
      clonedManuals
    });

  } catch (error: any) {
    console.error('❌ Error cloning manuals:', error);
    return NextResponse.json({ 
      error: 'Failed to clone manuals', 
      details: error?.message 
    }, { status: 500 });
  }
}

