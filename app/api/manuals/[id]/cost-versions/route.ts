import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - List all cost versions for a manual
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: manualId } = await params;

  try {
    // Turso schema doesn't have currency/isActive in ManualCostVersion
    const costVersions = await prisma.manualCostVersion.findMany({
      where: { manualId },
      include: {
        template: true,
        costLines: {
          include: {
            ingredient: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(costVersions);
  } catch (error) {
    console.error('Error fetching cost versions:', error);
    return NextResponse.json({ error: 'Failed to fetch cost versions' }, { status: 500 });
  }
}

// POST - Create or update cost version (calculate costs based on template)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: manualId } = await params;

  try {
    const body = await request.json();
    const { templateId, name, description } = body;

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
      where: { id: templateId },
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

    // Build a map of ingredient prices from template
    // Include packageQuantity (from master) to calculate unit price
    const priceMap = new Map<string, { 
      price: number; 
      currency: string; 
      yieldRate: number; 
      unit: string;
      packageQuantity: number; // 패키지 용량 (예: 카놀라유 16000g)
    }>();
    
    for (const item of template.items) {
      // Get package quantity from template item override or master
      const packageQuantity = item.quantity ?? item.ingredient.quantity ?? 1;
      let yieldRate = item.yieldRate ?? item.ingredient.yieldRate;
      if (!yieldRate || yieldRate <= 0) yieldRate = 100; // 수율 0 이하 방지

      priceMap.set(item.ingredientId, {
        price: item.price,
        currency: item.currency,
        yieldRate,
        unit: item.unit ?? item.ingredient.unit,
        packageQuantity: packageQuantity > 0 ? packageQuantity : 1 // 0으로 나누기 방지
      });
    }

    // Check if cost version already exists for this manual+template
    const existingVersion = await prisma.manualCostVersion.findUnique({
      where: {
        manualId_templateId: {
          manualId,
          templateId
        }
      }
    });

    // Calculate costs for each ingredient
    const costLines: Array<{
      ingredientId: string;
      unitPrice: number;
      quantity: number;
      unit: string;
      yieldRate: number;
      lineCost: number;
      notes?: string;
    }> = [];

    let totalCost = 0;

    for (const ing of manual.ingredients) {
      let unitPrice = 0;       // 단위당 가격 (패키지가격 / 패키지용량)
      let yieldRate = 100;
      let unit = ing.unit;
      let packageQuantity = 1;

      // If linked to master ingredient, get price from template
      if (ing.ingredientId && priceMap.has(ing.ingredientId)) {
        const priceInfo = priceMap.get(ing.ingredientId)!;
        packageQuantity = priceInfo.packageQuantity;
        // 단위당 가격 = 패키지 가격 / 패키지 용량
        unitPrice = priceInfo.price / packageQuantity;
        yieldRate = priceInfo.yieldRate > 0 ? priceInfo.yieldRate : 100;
        // Unit conversion logic can be added here if needed
      }

      // Calculate line cost: 
      // (패키지가격 / 패키지용량) × 사용량 × (100 / 수율)
      // = unitPrice × ing.quantity × (100 / yieldRate)
      const safeYieldRate = yieldRate > 0 ? yieldRate : 100;
      const lineCost = unitPrice * ing.quantity * (100 / safeYieldRate);
      totalCost += lineCost;

      costLines.push({
        ingredientId: ing.id,
        unitPrice,
        quantity: ing.quantity,
        unit,
        yieldRate,
        lineCost,
        notes: !ing.ingredientId ? 'Not linked to master ingredient' : undefined
      });
    }

    // Calculate cost per unit if yield is set
    const costPerUnit = manual.yield ? totalCost / manual.yield : null;

    if (existingVersion) {
      // Update existing version
      // Delete old cost lines
      await prisma.manualCostLine.deleteMany({
        where: { costVersionId: existingVersion.id }
      });

      // Update version
      const updatedVersion = await prisma.manualCostVersion.update({
        where: { id: existingVersion.id },
        data: {
          name: name || existingVersion.name,
          description: description || existingVersion.description,
          totalCost,
          costPerUnit,
          calculatedAt: new Date(),
          costLines: {
            create: costLines.map(cl => ({
              manualIngredientId: cl.ingredientId,
              unitPrice: cl.unitPrice,
              quantity: cl.quantity,
              unit: cl.unit,
              yieldRate: cl.yieldRate,
              lineCost: cl.lineCost,
              notes: cl.notes
            }))
          }
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
    } else {
      // Create new version
      const newVersion = await prisma.manualCostVersion.create({
        data: {
          manualId,
          templateId,
          name: name || `${template.name} Cost`,
          description,
          totalCost,
          costPerUnit,
          calculatedAt: new Date(),
          costLines: {
            create: costLines.map(cl => ({
              manualIngredientId: cl.ingredientId,
              unitPrice: cl.unitPrice,
              quantity: cl.quantity,
              unit: cl.unit,
              yieldRate: cl.yieldRate,
              lineCost: cl.lineCost,
              notes: cl.notes
            }))
          }
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

      return NextResponse.json(newVersion, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating cost version:', error);
    return NextResponse.json({ error: 'Failed to create cost version' }, { status: 500 });
  }
}
