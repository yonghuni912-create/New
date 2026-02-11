import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// In-memory storage reference (local to this module, for fallback)
const pushSubscriptionsMap = new Map<string, any>();

// Remove push subscription
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string };
    const { endpoint } = await request.json();

    try {
      // Try to delete from database
      await prisma.$executeRaw`
        DELETE FROM PushSubscription 
        WHERE userId = ${user.id} AND endpoint = ${endpoint}
      `;
    } catch (dbError) {
      // Fallback to in-memory removal
      pushSubscriptionsMap.delete(user.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Push subscription removed',
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to remove subscription' },
      { status: 500 }
    );
  }
}
