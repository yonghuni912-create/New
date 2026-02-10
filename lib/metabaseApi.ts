/**
 * metabaseApi.ts - Metabase API 클라이언트
 * Metabase Question 데이터를 직접 조회하여 Next.js에서 시각화
 */

const METABASE_URL = process.env.METABASE_URL || 'http://localhost:3000';
const METABASE_API_KEY = process.env.METABASE_API_KEY;

interface MetabaseQueryParams {
  [key: string]: string | number | null;
}

/**
 * Metabase Question(Card) 실행하여 데이터 가져오기
 */
export async function executeQuestion(
  questionId: number,
  params?: MetabaseQueryParams
): Promise<any[]> {
  if (!METABASE_API_KEY) {
    throw new Error('METABASE_API_KEY is not configured');
  }

  const url = `${METABASE_URL}/api/card/${questionId}/query/json`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': METABASE_API_KEY,
    },
    body: JSON.stringify({
      parameters: params ? Object.entries(params).map(([key, value]) => ({
        type: 'category',
        target: ['variable', ['template-tag', key]],
        value: value,
      })) : [],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Metabase API error:', error);
    throw new Error(`Metabase API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Metabase Question 메타데이터 가져오기
 */
export async function getQuestionMetadata(questionId: number): Promise<any> {
  if (!METABASE_API_KEY) {
    throw new Error('METABASE_API_KEY is not configured');
  }

  const response = await fetch(`${METABASE_URL}/api/card/${questionId}`, {
    headers: {
      'X-Api-Key': METABASE_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get question metadata: ${response.status}`);
  }

  return response.json();
}

/**
 * 네이티브 SQL 쿼리 실행 (Dataset API)
 */
export async function executeNativeQuery(
  databaseId: number,
  sql: string,
  params?: Record<string, any>
): Promise<any> {
  if (!METABASE_API_KEY) {
    throw new Error('METABASE_API_KEY is not configured');
  }

  const response = await fetch(`${METABASE_URL}/api/dataset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': METABASE_API_KEY,
    },
    body: JSON.stringify({
      database: databaseId,
      type: 'native',
      native: {
        query: sql,
        'template-tags': params || {},
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Metabase Dataset API error:', error);
    throw new Error(`Metabase Dataset API error: ${response.status}`);
  }

  const result = await response.json();
  
  // 결과를 배열 형태로 변환
  if (result.data && result.data.rows && result.data.cols) {
    const columns = result.data.cols.map((col: any) => col.name);
    return result.data.rows.map((row: any[]) => {
      const obj: Record<string, any> = {};
      columns.forEach((col: string, idx: number) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  }
  
  return [];
}

/**
 * 사용 가능한 데이터베이스 목록 조회
 */
export async function getDatabases(): Promise<any[]> {
  if (!METABASE_API_KEY) {
    throw new Error('METABASE_API_KEY is not configured');
  }

  const response = await fetch(`${METABASE_URL}/api/database`, {
    headers: {
      'X-Api-Key': METABASE_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get databases: ${response.status}`);
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * 대시보드 목록 조회
 */
export async function getDashboards(): Promise<any[]> {
  if (!METABASE_API_KEY) {
    throw new Error('METABASE_API_KEY is not configured');
  }

  const response = await fetch(`${METABASE_URL}/api/dashboard`, {
    headers: {
      'X-Api-Key': METABASE_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get dashboards: ${response.status}`);
  }

  return response.json();
}

/**
 * 특정 대시보드의 모든 카드(Question) 데이터 조회
 */
export async function getDashboardData(dashboardId: number): Promise<any> {
  if (!METABASE_API_KEY) {
    throw new Error('METABASE_API_KEY is not configured');
  }

  const response = await fetch(`${METABASE_URL}/api/dashboard/${dashboardId}`, {
    headers: {
      'X-Api-Key': METABASE_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get dashboard: ${response.status}`);
  }

  return response.json();
}

/**
 * API 연결 테스트
 */
export async function testConnection(): Promise<{ success: boolean; message: string; user?: any }> {
  if (!METABASE_API_KEY) {
    return { success: false, message: 'METABASE_API_KEY is not configured' };
  }

  try {
    const response = await fetch(`${METABASE_URL}/api/user/current`, {
      headers: {
        'X-Api-Key': METABASE_API_KEY,
      },
    });

    if (response.ok) {
      const user = await response.json();
      return { success: true, message: 'Connected successfully', user };
    } else {
      return { success: false, message: `API returned ${response.status}` };
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}
