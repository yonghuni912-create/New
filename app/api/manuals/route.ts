import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

// GET - List all menu manuals (Force redeploy)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeIngredients = searchParams.get('includeIngredients') === 'true';
  const includeCostVersions = searchParams.get('includeCostVersions') === 'true';
  const groupId = searchParams.get('groupId');
  const masterOnly = searchParams.get('masterOnly') === 'true';
  const priceTemplateId = searchParams.get('priceTemplateId');

  try {
    console.log('🔍 Fetching manuals...');
    console.log('Query params:', { groupId, includeIngredients, includeCostVersions, masterOnly, priceTemplateId });
    
    // Build where clause
    const whereClause: any = {};
    
    if (masterOnly) {
      // Only return master manuals (isMaster = true or isMaster is null for legacy)
      whereClause.OR = [
        { isMaster: true },
        { isMaster: null } // Legacy manuals without isMaster field
      ];
    }
    
    if (priceTemplateId) {
      // Return copies for specific template
      whereClause.priceTemplateId = priceTemplateId;
      whereClause.isMaster = false;
    }
    
    // Return all manuals, let frontend filter by isActive/isArchived
    // Always include ingredients to calculate linking stats
    const manuals = await prisma.menuManual.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: {
        ingredients: {
          orderBy: [
            { sortOrder: 'asc' }
          ],
          include: includeIngredients ? {
            ingredientMaster: true
          } : undefined
        },
        priceTemplate: true
      },
      orderBy: { name: 'asc' }
    });

    // Add linking stats to each manual
    const manualsWithStats = manuals.map(manual => {
      const totalIngredients = manual.ingredients?.length || 0;
      const linkedIngredients = manual.ingredients?.filter(ing => ing.ingredientId !== null).length || 0;
      const unlinkedIngredients = totalIngredients - linkedIngredients;
      
      return {
        ...manual,
        // Include ingredients only if requested
        ingredients: includeIngredients ? manual.ingredients : undefined,
        // Always include linking stats
        linkingStats: {
          total: totalIngredients,
          linked: linkedIngredients,
          unlinked: unlinkedIngredients,
          isFullyLinked: totalIngredients > 0 && unlinkedIngredients === 0,
          hasUnlinked: unlinkedIngredients > 0
        }
      };
    });

    console.log(`✅ Found ${manuals.length} manuals`);

    return NextResponse.json(manualsWithStats);
  } catch (error: any) {
    console.error('❌ Error fetching manuals:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    return NextResponse.json({ 
      error: 'Failed to fetch manuals',
      details: error?.message,
      stack: error?.stack?.split('\n').slice(0, 5).join('\n')
    }, { status: 500 });
  }
}

// POST - Create a new menu manual (Turso schema)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      name, 
      koreanName, 
      yield: yieldValue, 
      yieldUnit, 
      ingredients,
      sellingPrice,
      imageUrl,
      cookingMethod,
      shelfLife
    } = body;

    // Create manual with all fields
    const manual = await prisma.menuManual.create({
      data: {
        name,
        koreanName: koreanName || null,
        yield: yieldValue || 1,
        yieldUnit: yieldUnit || 'ea',
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
        imageUrl: imageUrl || null,
        cookingMethod: cookingMethod ? JSON.stringify(cookingMethod) : null,
        shelfLife: shelfLife || null,
        isActive: true,
        isArchived: false,
        isMaster: true, // 마스터 매뉴얼로 생성
        ingredients: ingredients && ingredients.length > 0 ? {
          create: ingredients.map((ing: any, index: number) => ({
            ingredientId: ing.ingredientId || null,
            name: ing.name || ing.koreanName || 'Unknown',
            koreanName: ing.koreanName || null,
            quantity: ing.quantity || 0,
            unit: ing.unit || 'g',
            sortOrder: index,
            notes: ing.notes || null,
            unitPrice: ing.unitPrice ?? null,       // pricing 가격
            baseQuantity: ing.baseQuantity ?? null  // pricing 기준 수량
          }))
        } : undefined
      },
      include: {
        ingredients: {
          orderBy: { sortOrder: 'asc' },
          include: {
            ingredientMaster: true
          }
        }
      }
    });

    // Create audit log
    await createAuditLog({
      userId: (session.user as { id: string }).id,
      action: 'MANUAL_CREATE',
      entityType: 'MenuManual',
      entityId: manual.id,
      newValue: { name: manual.name, koreanName: manual.koreanName }
    });

    return NextResponse.json(manual, { status: 201 });
  } catch (error: any) {
    console.error('=== Error creating manual ===');
    console.error('Error:', error?.message);
    
    return NextResponse.json({ 
      error: 'Failed to create manual', 
      details: error?.message,
      hint: error?.message
    }, { status: 500 });
  }
}
