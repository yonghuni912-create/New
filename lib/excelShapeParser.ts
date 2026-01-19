/**
 * Excel Shape Text Parser
 * 엑셀 도형(Shape) 내 텍스트를 추출하는 유틸리티
 * 
 * xlsx 파일은 ZIP 형식이며, 도형 텍스트는 xl/drawings/drawingN.xml에 저장됨
 * <a:t> 태그에서 텍스트를 추출하고, 위치 정보(row)도 함께 파싱
 */

import JSZip from 'jszip';

export interface ShapeTextInfo {
  text: string;
  row?: number;      // 도형이 앵커된 행 번호 (0-based)
  col?: number;      // 도형이 앵커된 열 번호 (0-based)
  sheetIndex: number; // 시트 인덱스 (1-based)
}

export interface SheetShapeTexts {
  sheetName: string;
  sheetIndex: number;
  shapes: ShapeTextInfo[];
}

/**
 * 엑셀 파일에서 모든 도형 텍스트를 추출
 * @param fileBuffer ArrayBuffer of xlsx file
 * @returns 시트별 도형 텍스트 배열
 */
export async function extractShapeTextsFromExcel(
  fileBuffer: ArrayBuffer
): Promise<Map<number, ShapeTextInfo[]>> {
  const zip = await JSZip.loadAsync(fileBuffer);
  const shapesBySheet = new Map<number, ShapeTextInfo[]>();
  
  // 시트-드로잉 매핑 찾기 (xl/worksheets/_rels/sheetN.xml.rels)
  const sheetDrawingMap = new Map<number, number>(); // sheetIndex -> drawingIndex
  
  const relsFiles = Object.keys(zip.files).filter(
    name => name.startsWith('xl/worksheets/_rels/sheet') && name.endsWith('.xml.rels')
  );
  
  for (const relsPath of relsFiles) {
    const sheetMatch = relsPath.match(/sheet(\d+)\.xml\.rels$/);
    if (!sheetMatch) continue;
    
    const sheetIndex = parseInt(sheetMatch[1], 10);
    const relsContent = await zip.file(relsPath)?.async('text');
    
    if (relsContent) {
      // drawing 관계 찾기
      const drawingMatch = relsContent.match(/Target="\.\.\/drawings\/drawing(\d+)\.xml"/);
      if (drawingMatch) {
        const drawingIndex = parseInt(drawingMatch[1], 10);
        sheetDrawingMap.set(sheetIndex, drawingIndex);
      }
    }
  }
  
  // 각 drawing 파일에서 도형 텍스트 추출
  const drawingFiles = Object.keys(zip.files).filter(
    name => name.startsWith('xl/drawings/drawing') && name.endsWith('.xml') && !name.includes('_rels')
  );
  
  for (const drawingPath of drawingFiles) {
    const drawingMatch = drawingPath.match(/drawing(\d+)\.xml$/);
    if (!drawingMatch) continue;
    
    const drawingIndex = parseInt(drawingMatch[1], 10);
    const drawingContent = await zip.file(drawingPath)?.async('text');
    
    if (!drawingContent) continue;
    
    // 이 drawing에 해당하는 sheet 찾기
    let sheetIndex = drawingIndex; // 기본값
    for (const [sIdx, dIdx] of sheetDrawingMap.entries()) {
      if (dIdx === drawingIndex) {
        sheetIndex = sIdx;
        break;
      }
    }
    
    const shapes = parseDrawingXml(drawingContent, sheetIndex);
    
    if (shapes.length > 0) {
      shapesBySheet.set(sheetIndex, shapes);
    }
  }
  
  return shapesBySheet;
}

/**
 * Drawing XML에서 도형 텍스트와 위치 파싱
 */
function parseDrawingXml(xmlContent: string, sheetIndex: number): ShapeTextInfo[] {
  const shapes: ShapeTextInfo[] = [];
  
  // twoCellAnchor 또는 oneCellAnchor에서 도형 찾기
  // <xdr:from><xdr:row>N</xdr:row></xdr:from> 에서 행 위치 추출
  // <a:t>텍스트</a:t> 에서 텍스트 추출
  
  // 각 앵커 블록을 분리
  const anchorPattern = /<xdr:(twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:\1>/g;
  let anchorMatch;
  
  while ((anchorMatch = anchorPattern.exec(xmlContent)) !== null) {
    const anchorContent = anchorMatch[2];
    
    // 행 위치 추출 (from 태그에서)
    const fromRowMatch = anchorContent.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
    const fromColMatch = anchorContent.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/);
    
    const row = fromRowMatch ? parseInt(fromRowMatch[1], 10) : undefined;
    const col = fromColMatch ? parseInt(fromColMatch[1], 10) : undefined;
    
    // 도형인지 확인 (sp 태그 존재)
    if (!anchorContent.includes('<xdr:sp>')) continue;
    
    // 텍스트 추출 - <a:t> 태그들
    const textPattern = /<a:t>([^<]*)<\/a:t>/g;
    let textMatch;
    const texts: string[] = [];
    
    while ((textMatch = textPattern.exec(anchorContent)) !== null) {
      const text = textMatch[1].trim();
      if (text) {
        texts.push(text);
      }
    }
    
    // 텍스트가 있는 도형만 추가
    if (texts.length > 0) {
      // 여러 <a:t> 태그가 있으면 합치기 (줄바꿈으로 분리된 경우)
      const fullText = texts.join(' ').trim();
      if (fullText) {
        shapes.push({
          text: fullText,
          row,
          col,
          sheetIndex
        });
      }
    }
  }
  
  // 행 기준으로 정렬
  shapes.sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  
  return shapes;
}

/**
 * 시트 인덱스별로 프로세스명 추출
 * 도형 텍스트 중 프로세스로 인식되는 것들만 필터링
 */
export function extractProcessLabelsFromShapes(
  shapes: ShapeTextInfo[],
  processOptions: string[]
): { label: string; row?: number }[] {
  const normalizedOptions = processOptions.map(opt => opt.toLowerCase().trim());
  
  const processLabels: { label: string; row?: number }[] = [];
  
  for (const shape of shapes) {
    const normalizedText = shape.text.toLowerCase().trim();
    
    // 프로세스 옵션과 매칭 확인 (부분 일치도 허용)
    const isProcess = normalizedOptions.some(opt => 
      normalizedText.includes(opt) || 
      opt.includes(normalizedText) ||
      calculateSimilarity(normalizedText, opt) > 0.7
    );
    
    // 또는 일반적인 프로세스 키워드 포함 확인
    const processKeywords = [
      'preparation', 'marination', 'battering', 'breading', 'frying',
      'grill', 'cooking', 'saute', 'sauce', 'seasoning', 'serving',
      'assembling', 'brushing', 'toss'
    ];
    
    const hasProcessKeyword = processKeywords.some(kw => 
      normalizedText.includes(kw)
    );
    
    if (isProcess || hasProcessKeyword) {
      processLabels.push({
        label: shape.text,
        row: shape.row
      });
    }
  }
  
  return processLabels;
}

/**
 * 간단한 유사도 계산 (Jaccard + char overlap)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const s2 = str2.toLowerCase().replace(/[^\w\s]/g, '').trim();
  
  const tokens1 = new Set(s1.split(/\s+/));
  const tokens2 = new Set(s2.split(/\s+/));
  
  let intersection = 0;
  tokens1.forEach(t => {
    if (tokens2.has(t)) intersection++;
  });
  
  const union = tokens1.size + tokens2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export default {
  extractShapeTextsFromExcel,
  extractProcessLabelsFromShapes
};
