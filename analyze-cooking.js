const XLSX = require('xlsx');
const wb = XLSX.readFile('2. 230321_bbqchicken_매뉴얼_.xlsx');

console.log('전체 시트 목록 중 일부:', wb.SheetNames.slice(40, 45));

// BB Wings 시트 분석 (인덱스 41)
const sheetIndex = 43; // '41.BB Wings(7pcs)' 시트
const ws = wb.Sheets[wb.SheetNames[sheetIndex]];
console.log('\n분석 시트:', wb.SheetNames[sheetIndex]);

// 전체 구조 먼저 확인
console.log('\n=== 전체 구조 스캔 (Row 1-100) ===');
for (let r = 1; r < 100; r++) {
  const cellA = ws['A' + r];
  const cellD = ws['D' + r];
  const cellH = ws['H' + r];
  const aVal = cellA ? String(cellA.v || '').trim() : '';
  const dVal = cellD ? String(cellD.v || '').trim() : '';
  const hVal = cellH ? String(cellH.v || '').trim() : '';
  
  if (aVal.toUpperCase().includes('PROCESS') || 
      aVal.toUpperCase().includes('COOKING') ||
      aVal.toUpperCase().includes('MANUAL') ||
      hVal.toUpperCase().includes('BBQ') ||
      aVal.toUpperCase().includes('NAME')) {
    console.log('Row ' + r + ': A="' + aVal.substring(0,30) + '", D="' + dVal.substring(0,30) + '", H="' + hVal + '"');
  }
}

// PROCESS/MANUAL 헤더 찾기
let processManualRow = -1;
for (let r = 1; r < 150; r++) {
  const cellA = ws['A' + r];
  const cellD = ws['D' + r];
  if (cellA && cellA.v && String(cellA.v).toUpperCase().includes('PROCESS') &&
      cellD && cellD.v && String(cellD.v).toUpperCase().includes('MANUAL')) {
    processManualRow = r;
    console.log('\nPROCESS/MANUAL 헤더 발견: Row', r);
    break;
  }
}

// BBQ CANADA 찾기 (PROCESS/MANUAL 이후)
let nextBbqCanada = -1;
for (let r = processManualRow + 1; r < 150; r++) {
  for (let c = 0; c < 10; c++) {
    const col = String.fromCharCode(65 + c);
    const cell = ws[col + r];
    if (cell && cell.v && String(cell.v).toUpperCase().includes('BBQ CANADA')) {
      nextBbqCanada = r;
      console.log('다음 BBQ CANADA: Row', r);
      break;
    }
  }
  if (nextBbqCanada > 0) break;
}

// 조리법 데이터 상세 출력 (빈행 포함)
console.log('\n=== 조리법 데이터 (빈행 표시) ===');
for (let r = processManualRow + 1; r < nextBbqCanada && r < processManualRow + 35; r++) {
  const cellA = ws['A' + r];
  const cellD = ws['D' + r];
  const aVal = cellA ? String(cellA.v || '').trim() : '';
  const dVal = cellD ? String(cellD.v || '').trim() : '';
  
  if (!aVal && !dVal) {
    console.log('Row ' + r + ': [빈 행] <<<');
  } else {
    const aDisplay = aVal || '(empty)';
    const dDisplay = dVal.substring(0, 50) || '(empty)';
    console.log('Row ' + r + ': A="' + aDisplay + '", D="' + dDisplay + '"');
  }
}
