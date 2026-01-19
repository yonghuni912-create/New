/**
 * Process PNG Asset Matching Utilities
 * 프로세스 PNG 자산 매칭 및 관리 유틸리티
 */

// Process Asset Index type
export interface ProcessAsset {
  filename: string;
  canonical_label: string;
  aliases: string[];
}

export interface ProcessAssetIndex {
  version: string;
  updated_at: string;
  default_png: string;
  fuzzy_threshold: number;
  alias_map: Record<string, string>;
  assets: Record<string, ProcessAsset>;
}

export interface MatchResult {
  matched: boolean;
  method: 'exact' | 'alias' | 'fuzzy' | 'default';
  filename: string;
  canonical_label: string;
  score: number;
  needs_verification: boolean;
  original_label: string;
}

// Normalize label for matching
export function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters except spaces
    .replace(/\s+/g, ' ')     // Normalize multiple spaces
    .trim();
}

// Calculate similarity score using token overlap + sequence matching
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeLabel(str1);
  const s2 = normalizeLabel(str2);
  
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0;
  
  // Token-based similarity
  const tokens1 = new Set(s1.split(' '));
  const tokens2 = new Set(s2.split(' '));
  
  let intersection = 0;
  tokens1.forEach(t => {
    if (tokens2.has(t)) intersection++;
  });
  
  const union = tokens1.size + tokens2.size - intersection;
  const jaccardScore = union > 0 ? intersection / union : 0;
  
  // Character sequence similarity (simple LCS ratio)
  const maxLen = Math.max(s1.length, s2.length);
  let commonChars = 0;
  const s2Chars = s2.split('');
  
  for (const char of s1) {
    const idx = s2Chars.indexOf(char);
    if (idx >= 0) {
      commonChars++;
      s2Chars.splice(idx, 1);
    }
  }
  
  const charScore = maxLen > 0 ? commonChars / maxLen : 0;
  
  // Combined score with token weight
  return jaccardScore * 0.6 + charScore * 0.4;
}

// Match process label to PNG file
export function matchProcessPng(
  label: string,
  assetIndex: ProcessAssetIndex
): MatchResult {
  const originalLabel = label;
  const normalized = normalizeLabel(label);
  
  // 1. Exact match
  if (assetIndex.assets[normalized]) {
    const asset = assetIndex.assets[normalized];
    return {
      matched: true,
      method: 'exact',
      filename: asset.filename,
      canonical_label: asset.canonical_label,
      score: 1.0,
      needs_verification: false,
      original_label: originalLabel
    };
  }
  
  // 2. Alias match
  const aliasTarget = assetIndex.alias_map[normalized];
  if (aliasTarget && assetIndex.assets[aliasTarget]) {
    const asset = assetIndex.assets[aliasTarget];
    return {
      matched: true,
      method: 'alias',
      filename: asset.filename,
      canonical_label: asset.canonical_label,
      score: 0.95,
      needs_verification: false,
      original_label: originalLabel
    };
  }
  
  // 3. Fuzzy match
  let bestMatch: { key: string; score: number } | null = null;
  
  for (const key of Object.keys(assetIndex.assets)) {
    const score = calculateSimilarity(normalized, key);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { key, score };
    }
    
    // Also check aliases
    const asset = assetIndex.assets[key];
    for (const alias of asset.aliases) {
      const aliasScore = calculateSimilarity(normalized, alias);
      if (aliasScore > (bestMatch?.score ?? 0)) {
        bestMatch = { key, score: aliasScore };
      }
    }
  }
  
  if (bestMatch && bestMatch.score >= assetIndex.fuzzy_threshold) {
    const asset = assetIndex.assets[bestMatch.key];
    return {
      matched: true,
      method: 'fuzzy',
      filename: asset.filename,
      canonical_label: asset.canonical_label,
      score: bestMatch.score,
      needs_verification: bestMatch.score < 0.9, // Mark for verification if score is borderline
      original_label: originalLabel
    };
  }
  
  // 4. Default fallback
  return {
    matched: false,
    method: 'default',
    filename: assetIndex.default_png,
    canonical_label: label, // Keep original as canonical
    score: 0,
    needs_verification: true,
    original_label: originalLabel
  };
}

// Get all available process labels from asset index
export function getAvailableProcessLabels(assetIndex: ProcessAssetIndex): string[] {
  return Object.values(assetIndex.assets).map(a => a.canonical_label);
}

// Get PNG URL for a process label
export function getProcessPngUrl(
  label: string,
  assetIndex: ProcessAssetIndex,
  basePath: string = '/process-icons'
): { url: string; matchResult: MatchResult } {
  const matchResult = matchProcessPng(label, assetIndex);
  const url = `${basePath}/${encodeURIComponent(matchResult.filename)}`;
  return { url, matchResult };
}

// Default process asset index (can be loaded from API/file)
export const DEFAULT_PROCESS_ASSET_INDEX: ProcessAssetIndex = {
  version: '1.0',
  updated_at: new Date().toISOString(),
  default_png: 'generic_process.png',
  fuzzy_threshold: 0.78,
  alias_map: {
    serve: 'serving',
    service: 'serving',
    assembling: 'assembling',
    assemble: 'assembling',
    'ingrediant preparation': 'ingredients preparation',
    ingredientpreparation: 'ingredients preparation',
    'batter mix solutionpreparation': 'batter mix solution',
    'batter mix solution preparation': 'batter mix solution',
    grilling: 'grill',
    grill: 'grill',
    'sautéing': 'saute',
    'sauté': 'saute',
    saute: 'saute',
    sauteing: 'saute',
    fry: 'frying',
    'deep frying': 'frying',
    'deep-frying': 'frying',
  },
  assets: {
    '2nd marination': { filename: '2nd Marination.png', canonical_label: '2nd Marination', aliases: ['second marination'] },
    assembling: { filename: 'Assembling.png', canonical_label: 'Assembling', aliases: ['assemble', 'assembly'] },
    'batter mix solution': { filename: 'Batter Mix Solution.png', canonical_label: 'Batter Mix Solution Preparation', aliases: ['batter mix solution preparation'] },
    battering: { filename: 'Battering.png', canonical_label: 'Battering', aliases: ['batter'] },
    breading: { filename: 'Breading.png', canonical_label: 'Breading', aliases: ['bread'] },
    'brushing sauce': { filename: 'Brushing Sauce.png', canonical_label: 'Brushing Sauce', aliases: ['brush sauce'] },
    cooking: { filename: 'Cooking.png', canonical_label: 'Cooking', aliases: ['cook', 'heat'] },
    frying: { filename: 'Frying.png', canonical_label: 'Frying', aliases: ['fry', 'deep frying'] },
    grill: { filename: 'Grill.png', canonical_label: 'Grilling', aliases: ['grilling'] },
    'ingredients preparation': { filename: 'Ingredients Preparation.png', canonical_label: 'Ingredients Preparation', aliases: ['ingredient preparation', 'prep'] },
    marination: { filename: 'Marination.png', canonical_label: 'Marination', aliases: ['marinate', 'marinade'] },
    'sauce mix': { filename: 'Sauce Mix.png', canonical_label: 'Sauce Preparation', aliases: ['mix sauce', 'sauce preparation'] },
    saute: { filename: 'Saute.png', canonical_label: 'Sautéing', aliases: ['sautéing', 'sauté'] },
    'seasoning toss': { filename: 'Seasoning Toss.png', canonical_label: 'Seasoning', aliases: ['seasoning', 'toss seasoning'] },
    serving: { filename: 'Serving.png', canonical_label: 'Serve', aliases: ['serve', 'service', 'plating'] },
  }
};
