const XLSX = require('xlsx');
const wb = XLSX.readFile('2. 230321_bbqchicken_매뉴얼_.xlsx');

// BB Wings 시트 분석 (인덱스 43)
const sheetIndex = 43;
const ws = wb.Sheets[wb.SheetNames[sheetIndex]];
console.log('분석 시트:', wb.SheetNames[sheetIndex]);

// PROCESS/MANUAL 헤더 찾기
let processManualRow = -1;
for (let r = 1; r < 150; r++) {
  const cellA = ws['A' + r];
  const cellD = ws['D' + r];
  if (cellA && cellA.v && String(cellA.v).toUpperCase().includes('PROCESS') &&
      cellD && cellD.v && String(cellD.v).toUpperCase().includes('MANUAL')) {
    processManualRow = r;
    console.log('PROCESS/MANUAL 헤더: Row', r);
    break;
  }
}

// 다음 BBQ CANADA 찾기
let nextBbqCanada = -1;
for (let r = processManualRow + 1; r < 150; r++) {
  for (let c = 0; c < 10; c++) {
    const col = String.fromCharCode(65 + c);
    const cell = ws[col + r];
    if (cell && cell.v && String(cell.v).toUpperCase().includes('BBQ CANADA')) {
      nextBbqCanada = r;
      break;
    }
  }
  if (nextBbqCanada > 0) break;
}
console.log('다음 BBQ CANADA: Row', nextBbqCanada);

// 새로운 파싱 로직 테스트 - 빈 행 기준으로 프로세스 구분
console.log('\n=== 새 파싱 로직 (빈행=프로세스구분) ===');
const cookingMethod = [];
let processIndex = 1;
let currentManualLines = [];

for (let r = processManualRow + 1; r < nextBbqCanada; r++) {
  const cellA = ws['A' + r];
  const cellD = ws['D' + r];
  const aVal = cellA ? String(cellA.v || '').trim() : '';
  const dVal = cellD ? String(cellD.v || '').trim() : '';
  
  const isEmptyRow = !aVal && !dVal;
  
  if (isEmptyRow) {
    // 빈 행: 현재까지의 프로세스 저장
    if (currentManualLines.length > 0) {
      cookingMethod.push({
        process: 'Process ' + processIndex,
        manual: currentManualLines.join('\\n'),
        lineCount: currentManualLines.length
      });
      processIndex++;
      currentManualLines = [];
    }
    console.log('Row ' + r + ': [빈 행 - 프로세스 구분] <<<');
  } else {
    // 데이터 행
    if (dVal) {
      const cleanLine = dVal.replace(/^[▶\-•]\s*/, '').trim();
      if (cleanLine.length > 0) {
        currentManualLines.push('▶' + cleanLine);
      }
    }
    console.log('Row ' + r + ': Process ' + processIndex + ' - "' + dVal.substring(0, 40) + '"');
  }
}

// 마지막 프로세스 저장
if (currentManualLines.length > 0) {
  cookingMethod.push({
    process: 'Process ' + processIndex,
    manual: currentManualLines.join('\\n'),
    lineCount: currentManualLines.length
  });
}

console.log('\n=== 파싱 결과 ===');
cookingMethod.forEach((c, i) => {
  console.log((i+1) + '. ' + c.process + ' (' + c.lineCount + '줄)');
});
console.log('총 ' + cookingMethod.length + '개 프로세스');
