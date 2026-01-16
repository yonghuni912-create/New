import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export const dynamic = 'force-dynamic';

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Calculate similarity score (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLen;
}

// Normalize ingredient name for better matching
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()（）\[\]【】]/g, ' ')  // Remove brackets
    .replace(/\s+/g, ' ')              // Normalize spaces
    .replace(/^[├└│─\s]+/, '')         // Remove tree prefixes like ├, └
    .replace(/^l\s+/i, '')             // Remove "L " prefix
    .trim();
}

// Extract key words from ingredient name
function extractKeywords(name: string): string[] {
  const normalized = normalizeIngredientName(name);
  const stopWords = ['and', 'or', 'the', 'a', 'an', 'of', 'for', 'with', 'in', 'on'];
  
  return normalized
    .split(/\s+/)
    .filter(word => word.length > 1 && !stopWords.includes(word));
}

interface IngredientMaster {
  id: string;
  englishName: string;
  koreanName: string;
  unit: string;
  category: string;
  quantity: number | null;
  yieldRate: number | null;
}

interface LinkResult {
  inputName: string;
  matchedIngredient: IngredientMaster | null;
  similarity: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  alternativeSuggestions: IngredientMaster[];
}

// POST - Auto-link ingredient names to master ingredients
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ingredientNames } = body;
    
    if (!Array.isArray(ingredientNames) || ingredientNames.length === 0) {
      return NextResponse.json({ error: 'ingredientNames array is required' }, { status: 400 });
    }
    
    const db = getDb();
    
    // Fetch all master ingredients
    const mastersResult = await db.execute({
      sql: `SELECT id, englishName, koreanName, unit, category, quantity, yieldRate FROM IngredientMaster ORDER BY englishName`,
      args: [],
    });
    
    const masters: IngredientMaster[] = mastersResult.rows.map(row => ({
      id: row.id as string,
      englishName: row.englishName as string || '',
      koreanName: row.koreanName as string || '',
      unit: row.unit as string || 'g',
      category: row.category as string || '',
      quantity: row.quantity as number | null,
      yieldRate: row.yieldRate as number | null,
    }));
    
    const results: LinkResult[] = [];
    
    for (const inputName of ingredientNames) {
      if (!inputName || typeof inputName !== 'string') {
        results.push({
          inputName: inputName || '',
          matchedIngredient: null,
          similarity: 0,
          confidence: 'none',
          alternativeSuggestions: [],
        });
        continue;
      }
      
      const normalizedInput = normalizeIngredientName(inputName);
      const inputKeywords = extractKeywords(inputName);
      
      // Calculate similarity for each master ingredient
      const scored = masters.map(master => {
        const normalizedEnglish = normalizeIngredientName(master.englishName);
        const normalizedKorean = normalizeIngredientName(master.koreanName);
        
        // Direct similarity
        const englishSimilarity = calculateSimilarity(normalizedInput, normalizedEnglish);
        const koreanSimilarity = calculateSimilarity(normalizedInput, normalizedKorean);
        
        // Keyword matching bonus
        const masterKeywords = [
          ...extractKeywords(master.englishName),
          ...extractKeywords(master.koreanName)
        ];
        
        let keywordMatchCount = 0;
        for (const keyword of inputKeywords) {
          if (masterKeywords.some(mk => mk.includes(keyword) || keyword.includes(mk))) {
            keywordMatchCount++;
          }
        }
        const keywordBonus = inputKeywords.length > 0 
          ? (keywordMatchCount / inputKeywords.length) * 0.3 
          : 0;
        
        const totalSimilarity = Math.min(1, Math.max(englishSimilarity, koreanSimilarity) + keywordBonus);
        
        return {
          master,
          similarity: totalSimilarity,
        };
      });
      
      // Sort by similarity descending
      scored.sort((a, b) => b.similarity - a.similarity);
      
      const topMatch = scored[0];
      const alternatives = scored.slice(1, 4).map(s => s.master);
      
      // Determine confidence level
      let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
      if (topMatch.similarity >= 0.85) {
        confidence = 'high';
      } else if (topMatch.similarity >= 0.65) {
        confidence = 'medium';
      } else if (topMatch.similarity >= 0.4) {
        confidence = 'low';
      }
      
      results.push({
        inputName,
        matchedIngredient: confidence !== 'none' ? topMatch.master : null,
        similarity: topMatch.similarity,
        confidence,
        alternativeSuggestions: alternatives,
      });
    }
    
    return NextResponse.json({
      success: true,
      results,
      totalMatched: results.filter(r => r.matchedIngredient !== null).length,
      totalUnmatched: results.filter(r => r.matchedIngredient === null).length,
    });
    
  } catch (error: any) {
    console.error('❌ Auto-link error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-link ingredients', details: error?.message },
      { status: 500 }
    );
  }
}
