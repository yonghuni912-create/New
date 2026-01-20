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
  
  // 1. workbook.xml.rels에서 rId와 실제 sheet 파일 매핑 찾기
  const workbookRelsContent = await zip.file('xl/_rels/workbook.xml.rels')?.async('text');
  const rIdToSheetFile = new Map<string, string>(); // rId1 -> sheet1.xml
  
  if (workbookRelsContent) {
    const relPattern = /<Relationship[^>]+Id="(rId\d+)"[^>]+Target="worksheets\/(sheet\d+\.xml)"/g;
    let relMatch;
    while ((relMatch = relPattern.exec(workbookRelsContent)) !== null) {
      rIdToSheetFile.set(relMatch[1], relMatch[2]);
    }
    // Alternative pattern (Target before Id)
    const relPattern2 = /<Relationship[^>]+Target="worksheets\/(sheet\d+\.xml)"[^>]+Id="(rId\d+)"/g;
    while ((relMatch = relPattern2.exec(workbookRelsContent)) !== null) {
      rIdToSheetFile.set(relMatch[2], relMatch[1]);
    }
  }
  
  // 2. workbook.xml에서 시트 표시 순서와 rId 매핑 찾기
  const workbookContent = await zip.file('xl/workbook.xml')?.async('text');
  const displayOrderToSheetFile = new Map<number, string>(); // 1-based display order -> sheet1.xml
  
  if (workbookContent) {
    // <sheet name="Menu Name" sheetId="1" r:id="rId1"/>
    const sheetPattern = /<sheet[^>]+name="[^"]*"[^>]+r:id="(rId\d+)"[^>]*\/>/g;
    let sheetMatch;
    let displayOrder = 1;
    
    while ((sheetMatch = sheetPattern.exec(workbookContent)) !== null) {
      const rId = sheetMatch[1];
      const sheetFile = rIdToSheetFile.get(rId);
      if (sheetFile) {
        displayOrderToSheetFile.set(displayOrder, sheetFile);
      }
      displayOrder++;
    }
  }
  
  // 3. sheet 파일에서 drawing 매핑 찾기 (sheetN.xml -> drawingN.xml)
  const sheetFileToDrawingIndex = new Map<string, number>(); // sheet1.xml -> 1
  
  const relsFiles = Object.keys(zip.files).filter(
    name => name.startsWith('xl/worksheets/_rels/sheet') && name.endsWith('.xml.rels')
  );
  
  for (const relsPath of relsFiles) {
    const sheetMatch = relsPath.match(/sheet(\d+)\.xml\.rels$/);
    if (!sheetMatch) continue;
    
    const sheetFileName = `sheet${sheetMatch[1]}.xml`;
    const relsContent = await zip.file(relsPath)?.async('text');
    
    if (relsContent) {
      // drawing 관계 찾기
      const drawingMatch = relsContent.match(/Target="\.\.\/drawings\/drawing(\d+)\.xml"/);
      if (drawingMatch) {
        const drawingIndex = parseInt(drawingMatch[1], 10);
        sheetFileToDrawingIndex.set(sheetFileName, drawingIndex);
      }
    }
  }
  
  // 4. 각 drawing 파일에서 도형 텍스트 추출
  const drawingFiles = Object.keys(zip.files).filter(
    name => name.startsWith('xl/drawings/drawing') && name.endsWith('.xml') && !name.includes('_rels')
  );
  
  for (const drawingPath of drawingFiles) {
    const drawingMatch = drawingPath.match(/drawing(\d+)\.xml$/);
    if (!drawingMatch) continue;
    
    const drawingIndex = parseInt(drawingMatch[1], 10);
    const drawingContent = await zip.file(drawingPath)?.async('text');
    
    if (!drawingContent) continue;
    
    // 이 drawing에 해당하는 표시 순서(display order) 찾기
    let displayOrder = drawingIndex; // 기본값 (fallback)
    
    // sheetFile -> displayOrder 역매핑
    for (const [order, sheetFile] of displayOrderToSheetFile.entries()) {
      const dIdx = sheetFileToDrawingIndex.get(sheetFile);
      if (dIdx === drawingIndex) {
        displayOrder = order;
        break;
      }
    }
    
    const shapes = parseDrawingXml(drawingContent, displayOrder);
    
    if (shapes.length > 0) {
      shapesBySheet.set(displayOrder, shapes);
      console.log(`📐 Sheet display order ${displayOrder}: Found ${shapes.length} shapes with text:`, 
        shapes.map(s => s.text).slice(0, 5));
    }
  }
  
  return shapesBySheet;
}

/**
 * Drawing XML에서 도형 텍스트와 위치 파싱
 * 일반 도형(sp), 그룹 도형(grpSp), 커스텀 도형(custSp) 모두 처리
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
    
    // 도형 존재 확인 - sp, grpSp, custSp 모두 허용
    // (이미지나 차트가 아닌 경우에만 텍스트 추출)
    const hasShape = anchorContent.includes('<xdr:sp>') || 
                     anchorContent.includes('<xdr:grpSp>') ||
                     anchorContent.includes('<xdr:cxnSp>') ||
                     anchorContent.includes('<xdr:nvSpPr>');
    
    // 텍스트 추출 - <a:t> 태그들 (도형 유무와 관계없이 추출 시도)
    const textPattern = /<a:t>([^<]*)<\/a:t>/g;
    let textMatch;
    const texts: string[] = [];
    
    while ((textMatch = textPattern.exec(anchorContent)) !== null) {
      const text = textMatch[1].trim();
      if (text) {
        texts.push(text);
      }
    }
    
    // 텍스트가 있는 경우 추가
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
  
  // 그룹 도형 내부의 텍스트도 별도로 추출 (앵커 외부에 있을 수 있음)
  // 독립적인 <xdr:grpSp> 블록 처리
  const grpSpPattern = /<xdr:grpSp>([\s\S]*?)<\/xdr:grpSp>/g;
  let grpMatch;
  
  while ((grpMatch = grpSpPattern.exec(xmlContent)) !== null) {
    const grpContent = grpMatch[1];
    
    // 그룹 내 개별 sp 도형에서 텍스트 추출
    const spPattern = /<xdr:sp>([\s\S]*?)<\/xdr:sp>/g;
    let spMatch;
    
    while ((spMatch = spPattern.exec(grpContent)) !== null) {
      const spContent = spMatch[1];
      
      const textPattern = /<a:t>([^<]*)<\/a:t>/g;
      let textMatch;
      const texts: string[] = [];
      
      while ((textMatch = textPattern.exec(spContent)) !== null) {
        const text = textMatch[1].trim();
        if (text) {
          texts.push(text);
        }
      }
      
      if (texts.length > 0) {
        const fullText = texts.join(' ').trim();
        // 중복 체크
        if (fullText && !shapes.some(s => s.text === fullText)) {
          shapes.push({
            text: fullText,
            row: undefined, // 그룹 내부는 위치 정보 없음
            col: undefined,
            sheetIndex
          });
        }
      }
    }
  }
  
  // 행 기준으로 정렬 (row가 없는 것은 뒤로)
  shapes.sort((a, b) => {
    if (a.row === undefined && b.row === undefined) return 0;
    if (a.row === undefined) return 1;
    if (b.row === undefined) return -1;
    return a.row - b.row;
  });
  
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
