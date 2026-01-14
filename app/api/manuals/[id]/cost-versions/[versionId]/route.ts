import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Get a single cost version with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { versionId } = await params;

  try {
    const costVersion = await prisma.manualCostVersion.findUnique({
      where: { id: versionId },
      include: {
        template: {
          include: {
            items: {
              include: {
                ingredient: true
              }
            }
          }
        },
        costLines: {
          include: {
            ingredient: {
              include: {
                ingredientMaster: true
              }
            }
          }
        },
        manual: true
      }
    });

    if (!costVersion) {
      return NextResponse.json({ error: 'Cost version not found' }, { status: 404 });
    }

    return NextResponse.json(costVersion);
  } catch (error) {
    console.error('Error fetching cost version:', error);
    return NextResponse.json({ error: 'Failed to fetch cost version' }, { status: 500 });
  }
}

// DELETE - Delete a cost version
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { versionId } = await params;

  try {
    await prisma.manualCostVersion.delete({
      where: { id: versionId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cost version:', error);
    return NextResponse.json({ error: 'Failed to delete cost version' }, { status: 500 });
  }
}

// PUT - Recalculate cost version
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: manualId, versionId } = await params;

  try {
    const costVersion = await prisma.manualCostVersion.findUnique({
      where: { id: versionId },
      include: { template: true }
    });

    if (!costVersion) {
      return NextResponse.json({ error: 'Cost version not found' }, { status: 404 });
    }

    // Fetch manual with ingredients
    const manual = await prisma.menuManual.findUnique({
      where: { id: manualId },
      include: {
        ingredients: {
          include: {
            ingredientMaster: true
          }
        }
      }
    });

    if (!manual) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }

    // Fetch template with items
    const template = await prisma.ingredientTemplate.findUnique({
      where: { id: costVersion.templateId },
      include: {
        items: {
          include: {
            ingredient: true
          }
        }
      }
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Build price map with package quantity for unit price calculation
    const priceMap = new Map<string, { 
      price: number; 
      currency: string; 
      yieldRate: number; 
      unit: string;
      packageQuantity: number;
    }>();
    
    for (const item of template.items) {
      const packageQuantity = item.quantity ?? item.ingredient.quantity ?? 1;
      priceMap.set(item.ingredientId, {
        price: item.price,
        currency: item.currency,
        yieldRate: item.yieldRate ?? item.ingredient.yieldRate,
        unit: item.unit ?? item.ingredient.unit,
        packageQuantity: packageQuantity > 0 ? packageQuantity : 1
      });
    }

    // Delete old cost lines
    await prisma.manualCostLine.deleteMany({
      where: { costVersionId: versionId }
    });

    // Recalculate costs (Turso schema uses manualIngredientId)
    const costLines: Array<{
      costVersionId: string;
      manualIngredientId: string;
      unitPrice: number;
      quantity: number;
      unit: string;
      yieldRate: number;
      lineCost: number;
      notes?: string;
    }> = [];

    let totalCost = 0;

    for (const ing of manual.ingredients) {
      let unitPrice = 0;       // 단위당 가격
      let yieldRate = 100;
      let unit = ing.unit;

      if (ing.ingredientId && priceMap.has(ing.ingredientId)) {
        const priceInfo = priceMap.get(ing.ingredientId)!;
        // 단위당 가격 = 패키지 가격 / 패키지 용량
        unitPrice = priceInfo.price / priceInfo.packageQuantity;
        yieldRate = priceInfo.yieldRate;
      }

      // 원가 = 단위당 가격 × 사용량 × (100 / 수율)
      const lineCost = unitPrice * ing.quantity * (100 / yieldRate);
      totalCost += lineCost;

      costLines.push({
        costVersionId: versionId,
        manualIngredientId: ing.id,  // Turso schema uses manualIngredientId
        unitPrice,
        quantity: ing.quantity,
        unit,
        yieldRate,
        lineCost,
        notes: !ing.ingredientId ? 'Not linked to master ingredient' : undefined
      });
    }

    // Create new cost lines
    await prisma.manualCostLine.createMany({
      data: costLines
    });

    // Update version totals
    const costPerUnit = manual.yield ? totalCost / manual.yield : null;
    
    const updatedVersion = await prisma.manualCostVersion.update({
      where: { id: versionId },
      data: {
        totalCost,
        costPerUnit,
        calculatedAt: new Date()
      },
      include: {
        template: true,
        costLines: {
          include: {
            ingredient: true
          }
        }
      }
    });

    return NextResponse.json(updatedVersion);
  } catch (error) {
    console.error('Error recalculating cost version:', error);
    return NextResponse.json({ error: 'Failed to recalculate cost version' }, { status: 500 });
  }
}
