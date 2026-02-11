import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// In-memory storage for development
const pushSubscriptionsMap = new Map<string, any>();

// Store push subscription for a user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string };
    const subscription = await request.json();

    // Store subscription in database
    // We'll store it in the User model's metadata or a separate table
    // For now, we'll use a simple approach with a PushSubscription table

    // Check if PushSubscription model exists, if not use User metadata
    try {
      // Try to upsert push subscription
      await prisma.$executeRaw`
        INSERT INTO PushSubscription (id, userId, endpoint, p256dh, auth, createdAt, updatedAt)
        VALUES (${crypto.randomUUID()}, ${user.id}, ${subscription.endpoint}, ${subscription.keys?.p256dh || ''}, ${subscription.keys?.auth || ''}, datetime('now'), datetime('now'))
        ON CONFLICT(endpoint) DO UPDATE SET
          userId = ${user.id},
          p256dh = ${subscription.keys?.p256dh || ''},
          auth = ${subscription.keys?.auth || ''},
          updatedAt = datetime('now')
      `;
    } catch (dbError) {
      // If PushSubscription table doesn't exist, store in memory
      console.log('PushSubscription table not found, storing in memory');
      // In-memory fallback (for development)
      pushSubscriptionsMap.set(user.id, subscription);
    }

    return NextResponse.json({
      success: true,
      message: 'Push subscription saved',
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}
