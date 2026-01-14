import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ===== 원가 재계산 유틸리티 함수 =====

/**
 * 특정 템플릿을 사용하는 모든 CostVersion의 원가를 재계산
 * @param templateId - 가격 템플릿 ID
 * @param ingredientMasterId - (선택) 특정 식재료만 업데이트 시
 */
async function recalculateCostVersionsForTemplate(
  templateId: string, 
  ingredientMasterId?: string
) {
  // 해당 템플릿을 사용하는 모든 CostVersion 조회 (Turso schema doesn't have isActive)
  const costVersions = await prisma.manualCostVersion.findMany({
    where: { templateId },
    include: {
      costLines: {
        include: {
          ingredient: {
            include: {
              ingredientMaster: true
            }
          }
        }
      },
      manual: {
        include: {
          ingredients: true
        }
      }
    }
  });

  for (const version of costVersions) {
    let totalCost = 0;

    for (const line of version.costLines) {
      // ingredientMasterId가 지정되었다면 해당 식재료만 업데이트
      if (ingredientMasterId && line.ingredient.ingredientId !== ingredientMasterId) {
        totalCost += line.lineCost;
        continue;
      }

      // 템플릿에서 최신 가격 조회
      const templateItem = await prisma.ingredientTemplateItem.findFirst({
        where: {
          templateId,
          ingredientId: line.ingredient.ingredientId || undefined
        },
        include: {
          ingredient: true // Master ingredient for packageQuantity
        }
      });

      if (templateItem) {
        // 패키지 용량 (템플릿 오버라이드 또는 마스터)
        const packageQuantity = templateItem.quantity ?? templateItem.ingredient.quantity ?? 1;
        const safePackageQty = packageQuantity > 0 ? packageQuantity : 1;
        
        // 단위당 가격 = 패키지 가격 / 패키지 용량
        const unitPrice = templateItem.price / safePackageQty;
        const yieldRate = templateItem.yieldRate ?? line.ingredient.ingredientMaster?.yieldRate ?? 100;
        
        // 원가 = 단위당 가격 × 사용량 × (100 / 수율)
        const lineCost = unitPrice * line.quantity * (100 / yieldRate);

        // CostLine 업데이트
        await prisma.manualCostLine.update({
          where: { id: line.id },
          data: {
            unitPrice,
            yieldRate,
            lineCost
          }
        });

        totalCost += lineCost;
      } else {
        totalCost += line.lineCost;
      }
    }

    // CostVersion 총 원가 업데이트
    const costPerUnit = version.manual.yield ? totalCost / version.manual.yield : null;
    
    await prisma.manualCostVersion.update({
      where: { id: version.id },
      data: {
        totalCost,
        costPerUnit,
        calculatedAt: new Date()
      }
    });
  }

  return costVersions.length;
}

/**
 * Master 식재료 수정 시 연관된 ManualIngredient 일괄 업데이트
 * @param ingredientMasterId - 마스터 식재료 ID
 * @param updates - 업데이트할 필드들
 */
async function updateRelatedManualIngredients(
  ingredientMasterId: string,
  updates: { koreanName?: string; englishName?: string }
) {
  const result = await prisma.manualIngredient.updateMany({
    where: { ingredientId: ingredientMasterId },
    data: {
      ...(updates.koreanName !== undefined && { koreanName: updates.koreanName }),
      ...(updates.englishName !== undefined && { name: updates.englishName })
    }
  });

  return result.count;
}

// GET - Get single template item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, itemId } = await params;

    const item = await prisma.ingredientTemplateItem.findFirst({
      where: {
        id: itemId,
        templateId: id
      },
      include: {
        ingredient: true,
        template: true
      }
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('Failed to fetch template item:', error);
    return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 });
  }
}

// PUT - Update template item (price, overrides, etc.)
// applyToAll: true  → Master 수정 + 모든 템플릿 반영 + 연관 매뉴얼 업데이트
// applyToAll: false → 이 템플릿만 오버라이드
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: templateId, itemId } = await params;
    const body = await request.json();
    const { 
      category, 
      koreanName, 
      englishName, 
      quantity, 
      unit, 
      yieldRate, 
      price, 
      currency,
      notes,
      applyToAll = false // 새로운 파라미터: 모든 템플릿에 적용할지 여부
    } = body;

    // 현재 아이템 조회
    const currentItem = await prisma.ingredientTemplateItem.findFirst({
      where: { id: itemId, templateId },
      include: { ingredient: true }
    });

    if (!currentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const ingredientMasterId = currentItem.ingredientId;
    let updatedMaster = null;
    let updatedTemplateItems = 0;
    let updatedManualIngredients = 0;
    let recalculatedCostVersions = 0;

    // applyToAll이 true면 Master를 수정하고 모든 템플릿에 반영
    if (applyToAll) {
      // 1. IngredientMaster 업데이트 (이름, 수량, 단위, 수율)
      const masterUpdates: Record<string, unknown> = {};
      if (category !== undefined) masterUpdates.category = category;
      if (koreanName !== undefined) masterUpdates.koreanName = koreanName;
      if (englishName !== undefined) masterUpdates.englishName = englishName;
      if (quantity !== undefined) masterUpdates.quantity = quantity;
      if (unit !== undefined) masterUpdates.unit = unit;
      if (yieldRate !== undefined) masterUpdates.yieldRate = yieldRate;

      if (Object.keys(masterUpdates).length > 0) {
        updatedMaster = await prisma.ingredientMaster.update({
          where: { id: ingredientMasterId },
          data: masterUpdates
        });

        // 2. 모든 템플릿의 오버라이드 값을 null로 리셋 (Master 값 사용하도록)
        const resetResult = await prisma.ingredientTemplateItem.updateMany({
          where: { ingredientId: ingredientMasterId },
          data: {
            category: null,
            koreanName: null,
            englishName: null,
            quantity: null,
            unit: null,
            yieldRate: null
          }
        });
        updatedTemplateItems = resetResult.count;

        // 3. 연관된 ManualIngredient도 업데이트
        if (koreanName !== undefined || englishName !== undefined) {
          updatedManualIngredients = await updateRelatedManualIngredients(
            ingredientMasterId,
            { koreanName, englishName }
          );
        }

        // 4. yieldRate가 변경되었으면 모든 템플릿의 원가 재계산
        if (yieldRate !== undefined) {
          const allTemplates = await prisma.ingredientTemplate.findMany({ select: { id: true } });
          for (const template of allTemplates) {
            const count = await recalculateCostVersionsForTemplate(template.id, ingredientMasterId);
            recalculatedCostVersions += count;
          }
        }
      }

      // 가격은 템플릿별로 다르므로 현재 템플릿만 업데이트
      if (price !== undefined || currency !== undefined || notes !== undefined) {
        // 가격이 변경되었으면 이력 저장
        if (price !== undefined && price !== currentItem.price) {
          await prisma.priceHistory.create({
            data: {
              templateItemId: itemId,
              oldPrice: currentItem.price,
              newPrice: price,
              currency: currency || currentItem.currency,
              changedBy: (session.user as any)?.id || 'system',
              reason: notes || 'Price update'
            }
          });
        }

        await prisma.ingredientTemplateItem.update({
          where: { id: itemId },
          data: {
            ...(price !== undefined && { price }),
            ...(currency !== undefined && { currency }),
            ...(notes !== undefined && { notes })
          }
        });

        // 가격 변경 시 해당 템플릿의 원가 재계산
        if (price !== undefined) {
          const count = await recalculateCostVersionsForTemplate(templateId, ingredientMasterId);
          recalculatedCostVersions += count;
        }
      }
    } else {
      // applyToAll이 false면 이 템플릿만 오버라이드
      // 가격 변경 이력 저장
      if (price !== undefined && price !== currentItem.price) {
        await prisma.priceHistory.create({
          data: {
            templateItemId: itemId,
            oldPrice: currentItem.price,
            newPrice: price,
            currency: currency || currentItem.currency,
            changedBy: (session.user as any)?.id || 'system',
            reason: notes || 'Price override'
          }
        });
      }

      await prisma.ingredientTemplateItem.update({
        where: { id: itemId },
        data: {
          ...(category !== undefined && { category }),
          ...(koreanName !== undefined && { koreanName }),
          ...(englishName !== undefined && { englishName }),
          ...(quantity !== undefined && { quantity }),
          ...(unit !== undefined && { unit }),
          ...(yieldRate !== undefined && { yieldRate }),
          ...(price !== undefined && { price }),
          ...(currency !== undefined && { currency }),
          ...(notes !== undefined && { notes })
        }
      });

      // 가격이나 수율 변경 시 해당 템플릿의 원가 재계산
      if (price !== undefined || yieldRate !== undefined) {
        recalculatedCostVersions = await recalculateCostVersionsForTemplate(templateId, ingredientMasterId);
      }
    }

    // 최종 결과 조회
    const item = await prisma.ingredientTemplateItem.findFirst({
      where: { id: itemId },
      include: { ingredient: true }
    });

    return NextResponse.json({
      item,
      applyToAll,
      updates: {
        master: updatedMaster ? true : false,
        templateItems: updatedTemplateItems,
        manualIngredients: updatedManualIngredients,
        costVersionsRecalculated: recalculatedCostVersions
      }
    });
  } catch (error) {
    console.error('Failed to update template item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

// PATCH - Bulk update template items
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { items } = body; // Array of { itemId, ...fields }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Items array required' }, { status: 400 });
    }

    const results = [];
    for (const item of items) {
      const { itemId, ...fields } = item;
      
      const updated = await prisma.ingredientTemplateItem.update({
        where: { id: itemId },
        data: {
          ...(fields.category !== undefined && { category: fields.category }),
          ...(fields.koreanName !== undefined && { koreanName: fields.koreanName }),
          ...(fields.englishName !== undefined && { englishName: fields.englishName }),
          ...(fields.quantity !== undefined && { quantity: fields.quantity }),
          ...(fields.unit !== undefined && { unit: fields.unit }),
          ...(fields.yieldRate !== undefined && { yieldRate: fields.yieldRate }),
          ...(fields.price !== undefined && { price: fields.price }),
          ...(fields.currency !== undefined && { currency: fields.currency }),
          ...(fields.notes !== undefined && { notes: fields.notes })
        }
      });
      
      results.push(updated);
    }

    return NextResponse.json({ updated: results.length, items: results });
  } catch (error) {
    console.error('Failed to bulk update template items:', error);
    return NextResponse.json({ error: 'Failed to update items' }, { status: 500 });
  }
}
