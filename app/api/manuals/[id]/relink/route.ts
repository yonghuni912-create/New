import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@libsql/client';

export const dynamic = 'force-dynamic';

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}

// 매뉴얼의 템플릿을 변경하고 식재료를 재링킹
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { priceTemplateId } = await request.json();
    const manualId = params.id;

    if (!priceTemplateId) {
      return NextResponse.json({ error: 'priceTemplateId is required' }, { status: 400 });
    }

    const db = getDb();

    // 1. 매뉴얼 존재 확인
    const manualResult = await db.execute({
      sql: `SELECT id, name, isMaster FROM MenuManual WHERE id = ?`,
      args: [manualId]
    });

    if (manualResult.rows.length === 0) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }

    const manual = manualResult.rows[0];

    // 2. 템플릿 존재 확인
    const templateResult = await db.execute({
      sql: `SELECT id, name, country FROM PriceTemplate WHERE id = ?`,
      args: [priceTemplateId]
    });

    if (templateResult.rows.length === 0) {
      return NextResponse.json({ error: 'Price template not found' }, { status: 404 });
    }

    const template = templateResult.rows[0];

    // 3. 매뉴얼의 식재료 목록 가져오기
    const ingredientsResult = await db.execute({
      sql: `SELECT id, name, koreanName, quantity, unit FROM ManualIngredient WHERE manualId = ?`,
      args: [manualId]
    });

    const ingredients = ingredientsResult.rows;

    // 4. 해당 템플릿의 아이템 목록 가져오기
    const templateItemsResult = await db.execute({
      sql: `SELECT pti.ingredientMasterId as id, 
                   COALESCE(pti.localEnglishName, im.englishName) as englishName, 
                   COALESCE(pti.localKoreanName, im.koreanName) as koreanName,
                   pti.unitPrice,
                   COALESCE(pti.localQuantity, im.quantity) as baseQuantity
            FROM PriceTemplateItem pti
            JOIN IngredientMaster im ON pti.ingredientMasterId = im.id
            WHERE pti.priceTemplateId = ?`,
      args: [priceTemplateId]
    });

    const templateItems = templateItemsResult.rows;

    // 5. 유사도 매칭 함수
    const normalize = (name: string): string => {
      return (name || '')
        .toLowerCase()
        .replace(/[()（）\[\]【】]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[├└│─\s]+/, '')
        .replace(/^l\s+/i, '')
        .trim();
    };

    const levenshtein = (a: string, b: string): number => {
      const matrix: number[][] = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          matrix[i][j] = b[i-1] === a[j-1]
            ? matrix[i-1][j-1]
            : Math.min(matrix[i-1][j-1] + 1, matrix[i][j-1] + 1, matrix[i-1][j] + 1);
        }
      }
      return matrix[b.length][a.length];
    };

    const similarity = (s1: string, s2: string): number => {
      const n1 = normalize(s1);
      const n2 = normalize(s2);
      if (n1 === n2) return 1;
      if (n1.includes(n2) || n2.includes(n1)) return 0.9;
      const maxLen = Math.max(n1.length, n2.length);
      if (maxLen === 0) return 1;
      return 1 - levenshtein(n1, n2) / maxLen;
    };

    // 6. 각 식재료에 대해 재링킹
    let linkedCount = 0;
    let unlinkedCount = 0;
    const now = new Date().toISOString();

    for (const ing of ingredients) {
      const ingName = ing.name as string || '';
      
      let bestMatch: { id: string; unitPrice: number; baseQuantity: number } | null = null;
      let bestSim = 0;

      for (const item of templateItems) {
        const engSim = similarity(ingName, item.englishName as string || '');
        const korSim = similarity(ingName, item.koreanName as string || '');
        const maxSim = Math.max(engSim, korSim);

        // 0.8 이상일 때만 링킹 (0.6에서 상향 - 더 엄격한 매칭)
        if (maxSim >= 0.8 && maxSim > bestSim) {
          bestSim = maxSim;
          bestMatch = {
            id: item.id as string,
            unitPrice: item.unitPrice as number || 0,
            baseQuantity: item.baseQuantity as number || 1
          };
        }
      }

      // 매칭 결과 업데이트
      if (bestMatch) {
        await db.execute({
          sql: `UPDATE ManualIngredient 
                SET ingredientId = ?, unitPrice = ?, baseQuantity = ?, updatedAt = ?
                WHERE id = ?`,
          args: [bestMatch.id, bestMatch.unitPrice, bestMatch.baseQuantity, now, ing.id]
        });
        linkedCount++;
      } else {
        // 매칭 안됨 - null로 설정
        await db.execute({
          sql: `UPDATE ManualIngredient 
                SET ingredientId = NULL, unitPrice = NULL, baseQuantity = NULL, updatedAt = ?
                WHERE id = ?`,
          args: [now, ing.id]
        });
        unlinkedCount++;
      }
    }

    // 7. 매뉴얼의 priceTemplateId 업데이트
    await db.execute({
      sql: `UPDATE MenuManual SET priceTemplateId = ?, isMaster = 0, updatedAt = ? WHERE id = ?`,
      args: [priceTemplateId, now, manualId]
    });

    console.log(`🔗 Relinked manual "${manual.name}" to template "${template.name}": ${linkedCount} linked, ${unlinkedCount} unlinked`);

    return NextResponse.json({
      success: true,
      manualId,
      priceTemplateId,
      templateName: template.name,
      country: template.country,
      totalIngredients: ingredients.length,
      linkedCount,
      unlinkedCount,
      message: `${linkedCount}/${ingredients.length} 식재료가 링킹되었습니다.`
    });

  } catch (error: any) {
    console.error('Relink error:', error);
    return NextResponse.json({ 
      error: 'Failed to relink ingredients',
      details: error?.message 
    }, { status: 500 });
  }
}
