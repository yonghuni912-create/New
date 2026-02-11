import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Store connected clients
const clients = new Map<string, {
  controller: ReadableStreamDefaultController;
  userId: string;
  storeId?: string;
}>();

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const user = session.user as { id: string; name: string; email: string };
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('storeId') || undefined;
  const clientId = `${user.id}-${Date.now()}`;

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      clients.set(clientId, { controller, userId: user.id, storeId });

      // Send initial ping
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'CONNECTED',
        payload: { clientId },
        timestamp: new Date().toISOString(),
      })}\n\n`));

      // Notify other clients about new user
      broadcastToClients({
        type: 'USER_JOINED',
        payload: { id: user.id, name: user.name, email: user.email },
        userId: user.id,
        timestamp: new Date().toISOString(),
      }, storeId, clientId);

      // Keep connection alive with heartbeat
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        clients.delete(clientId);
        
        // Notify other clients about user leaving
        broadcastToClients({
          type: 'USER_LEFT',
          payload: { id: user.id },
          userId: user.id,
          timestamp: new Date().toISOString(),
        }, storeId);
      });
    },
    cancel() {
      clients.delete(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Broadcast message to clients
function broadcastToClients(
  event: any,
  storeId?: string,
  excludeClientId?: string
) {
  const encoder = new TextEncoder();
  const message = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

  clients.forEach((client, clientId) => {
    // Skip excluded client
    if (excludeClientId && clientId === excludeClientId) return;
    
    // Filter by storeId if specified
    if (storeId && client.storeId !== storeId) return;

    try {
      client.controller.enqueue(message);
    } catch {
      // Client disconnected, remove from list
      clients.delete(clientId);
    }
  });
}

// Note: For broadcasting from other routes, use the /api/realtime/broadcast endpoint
// The broadcast function is internal to this route handler
