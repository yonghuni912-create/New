import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Metabase 설정 - localhost:3000으로 실행 중
const METABASE_URL = process.env.METABASE_URL || 'http://localhost:3000';
const METABASE_API_KEY = process.env.METABASE_API_KEY;

// AUTO - WindSurf Toast 컬렉션의 Question IDs
const COLLECTION_QUESTIONS = {
  dailyNetSales: 262,      // Daily Net Sales & Tickets (line chart)
  executiveKpi: 263,       // Executive KPI Snapshot (table)
  channelMix: 264,         // Channel Mix (Platform) (bar chart)
  serviceTime: 265,        // Service Time (Minutes) - Avg by Day (line chart)
  topMenuItems: 266,       // Top 20 Menu Items (table)
  paymentMix: 267,         // Payment Mix & Tips (bar chart)
  dashboardId: 193,        // HQ Core Ops Dashboard (Auto)
};

interface QuestionParams {
  business_date?: string;      // Date filter
  restaurant_guid?: string;    // Store filter
}

/**
 * GET /api/metabase/questions
 * Metabase 컬렉션의 Question 목록 반환
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    collection: {
      id: 66,
      name: 'AUTO - WindSurf Toast',
    },
    questions: [
      { id: 262, name: 'Daily Net Sales & Tickets', display: 'line', description: 'Core KPI trend: Net Sales & Tickets by day' },
      { id: 263, name: 'Executive KPI Snapshot', display: 'table', description: 'Net Sales, Tickets, Avg Check, Discount/Refund rate' },
      { id: 264, name: 'Channel Mix (Platform)', display: 'bar', description: 'Sales/Tickets split by platform' },
      { id: 265, name: 'Service Time (Minutes)', display: 'line', description: 'Avg service time by day' },
      { id: 266, name: 'Top 20 Menu Items', display: 'table', description: 'Menu velocity & sales concentration' },
      { id: 267, name: 'Payment Mix & Tips', display: 'bar', description: 'Payment/tip structure' },
    ],
    dashboard: { id: 193, name: 'HQ Core Ops Dashboard (Auto)' },
  });
}

/**
 * POST /api/metabase/questions
 * 특정 Question 실행하여 데이터 반환
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!METABASE_API_KEY) {
    return NextResponse.json(
      { error: 'Metabase API key not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { questionId, params } = body as { questionId: number; params?: QuestionParams };

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
    }

    // Build parameters array for Metabase API
    const parameters: any[] = [];
    
    if (params?.business_date) {
      parameters.push({
        id: '32188090-5f35-472e-91cb-a1eb09d4ae7e',
        type: 'date/all-options',
        target: ['dimension', ['template-tag', 'business_date']],
        value: params.business_date,
      });
    }
    
    if (params?.restaurant_guid) {
      parameters.push({
        id: '2746a8ab-c6a8-41a6-9cb6-009a90d84132',
        type: 'category',
        target: ['dimension', ['template-tag', 'restaurant_guid']],
        value: params.restaurant_guid,
      });
    }

    // Execute question via Metabase API
    const url = `${METABASE_URL}/api/card/${questionId}/query/json`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': METABASE_API_KEY,
      },
      body: JSON.stringify({ parameters }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Metabase API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to execute question', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      questionId,
      data,
      rowCount: Array.isArray(data) ? data.length : 0,
    });
  } catch (error) {
    console.error('Error executing Metabase question:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
