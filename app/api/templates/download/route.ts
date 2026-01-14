import { NextRequest, NextResponse } from 'next/server';

// All-in-One Template configuration
const TEMPLATE_CONFIG = {
  'all-in-one': {
    name: 'All-in-One Ingredient Template',
    headers: [
      'No',
      'Category',
      'Korean Name',
      'English Name',
      'Quantity',
      'Unit',
      'Yield (%)',
      'CAD',
      'Price/unit',
      'Supplier'
    ],
    headersKr: [
      'No',
      '카테고리',
      '품목명 (한글)',
      '상세사항 (영문)',
      '수량, 용량, 무게',
      '단위',
      '수율',
      'CAD',
      'Price/unit',
      'Supplier'
    ],
    example: ['1', 'Oil', '카놀라유', 'Canola oil', '16000', 'ml', '99', '$55.65', '0.0035', 'Costco'],
    instructions: [
      '✓ No: Sequential number (optional)',
      '✓ Category: Oil, Raw chicken, Sauce, Powder, Dry goods, Food, Produced',
      '✓ Korean Name: 한글 품목명',
      '✓ English Name: Detailed English description',
      '✓ Quantity: Package size/volume/weight',
      '✓ Unit: ml, g, L, kg, ea, pcs',
      '✓ Yield (%): 1-100 (수율, default 100)',
      '✓ CAD: Total price in Canadian dollars (with $ sign or without)',
      '✓ Price/unit: Calculated or manual unit price',
      '✓ Supplier: Vendor name (optional)',
      '',
      '⚠️ Empty cells are allowed - the system will use default values',
      '⚠️ At minimum, provide: Category, Korean Name or English Name, CAD price'
    ]
  }
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const templateType = searchParams.get('type') || 'all-in-one';
  const format = searchParams.get('format') || 'csv';

  if (!TEMPLATE_CONFIG[templateType as keyof typeof TEMPLATE_CONFIG]) {
    return NextResponse.json(
      { error: 'Invalid template type', availableTypes: Object.keys(TEMPLATE_CONFIG) },
      { status: 400 }
    );
  }

  const config = TEMPLATE_CONFIG[templateType as keyof typeof TEMPLATE_CONFIG];

  if (format === 'xlsx') {
    // For Excel format, we'll create a proper XLSX file
    // Using a simple XML-based approach that Excel can read
    const xmlContent = createExcelXML(config);
    
    return new NextResponse(xmlContent, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${templateType}-template.xlsx"`,
      },
    });
  }

  // CSV format (default)
  const csvContent = createCSV(config);
  
  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${templateType}-template.csv"`,
    },
  });
}

function createCSV(config: typeof TEMPLATE_CONFIG['all-in-one']): string {
  const BOM = '\uFEFF';
  const lines: string[] = [];
  
  // Add instructions as comments
  lines.push(`# ${config.name}`);
  lines.push('# Instructions / 작성 가이드:');
  config.instructions.forEach(inst => lines.push(`# ${inst}`));
  lines.push('#');
  lines.push('# Delete these comment lines (starting with #) before uploading');
  lines.push('# 업로드 전에 # 으로 시작하는 이 주석 줄들을 삭제하세요');
  lines.push('#');
  
  // Add header row
  lines.push(config.headers.join(','));
  
  // Add example row
  lines.push(config.example.map(escapeCSV).join(','));
  
  // Add empty rows for user
  for (let i = 0; i < 5; i++) {
    lines.push(config.headers.map(() => '').join(','));
  }
  
  return BOM + lines.join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function createExcelXML(config: typeof TEMPLATE_CONFIG['all-in-one']): string {
  // Create a simple XML spreadsheet that Excel can open
  const escapeXML = (str: string) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  let rows = '';
  
  // Title row
  rows += `<Row ss:StyleID="Title"><Cell ss:MergeAcross="${config.headers.length - 1}"><Data ss:Type="String">${escapeXML(config.name)}</Data></Cell></Row>\n`;
  
  // Instructions rows
  rows += `<Row><Cell ss:MergeAcross="${config.headers.length - 1}"><Data ss:Type="String">Instructions / 작성 가이드:</Data></Cell></Row>\n`;
  config.instructions.forEach(inst => {
    rows += `<Row><Cell ss:MergeAcross="${config.headers.length - 1}"><Data ss:Type="String">${escapeXML(inst)}</Data></Cell></Row>\n`;
  });
  
  // Empty row
  rows += '<Row></Row>\n';
  
  // Header row with style
  rows += '<Row ss:StyleID="Header">';
  config.headers.forEach(header => {
    rows += `<Cell><Data ss:Type="String">${escapeXML(header)}</Data></Cell>`;
  });
  rows += '</Row>\n';
  
  // Example row
  rows += '<Row ss:StyleID="Example">';
  config.example.forEach(value => {
    const isNumber = !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
    rows += `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${escapeXML(value)}</Data></Cell>`;
  });
  rows += '</Row>\n';
  
  // Empty rows for data
  for (let i = 0; i < 10; i++) {
    rows += '<Row>';
    config.headers.forEach(() => {
      rows += '<Cell><Data ss:Type="String"></Data></Cell>';
    });
    rows += '</Row>\n';
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:FontName="Arial" ss:Size="14" ss:Bold="1"/>
      <Interior ss:Color="#E8F4FC" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
      <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF"/>
    </Style>
    <Style ss:ID="Example">
      <Interior ss:Color="#FFF2CC" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Template">
    <Table>
      ${rows}
    </Table>
  </Worksheet>
</Workbook>`;
}
