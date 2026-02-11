import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// In-memory event store (for simplicity - in production use Redis)
const recentEvents: any[] = [];
const MAX_EVENTS = 100;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string; name: string };
    const { type, payload, storeId } = await request.json();

    const event = {
      type,
      payload,
      userId: user.id,
      userName: user.name,
      storeId,
      timestamp: new Date().toISOString(),
    };

    // Store event
    recentEvents.unshift(event);
    if (recentEvents.length > MAX_EVENTS) {
      recentEvents.pop();
    }

    // Note: In production, you would use a pub/sub system like Redis
    // to broadcast to all connected SSE clients
    // For now, this just stores the event

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('Broadcast error:', error);
    return NextResponse.json(
      { error: 'Failed to broadcast event' },
      { status: 500 }
    );
  }
}

// Get recent events for a store
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    let events = recentEvents;
    if (storeId) {
      events = events.filter((e) => e.storeId === storeId);
    }

    return NextResponse.json({
      events: events.slice(0, limit),
    });
  } catch (error) {
    console.error('Get events error:', error);
    return NextResponse.json(
      { error: 'Failed to get events' },
      { status: 500 }
    );
  }
}
