'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface RealtimeEvent {
  type: 'TASK_UPDATED' | 'TASK_CREATED' | 'TASK_DELETED' | 'COMMENT_ADDED' | 'STATUS_CHANGED' | 'USER_JOINED' | 'USER_LEFT';
  payload: any;
  userId: string;
  timestamp: string;
}

interface ActiveUser {
  id: string;
  name: string;
  email: string;
  color: string;
  lastActive: Date;
}

interface UseRealtimeOptions {
  storeId?: string;
  onEvent?: (event: RealtimeEvent) => void;
}

// Generate random color for user avatar
function generateUserColor(name: string): string {
  const colors = [
    '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899',
    '#EF4444', '#14B8A6', '#6366F1', '#F97316', '#84CC16',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function useRealtime({ storeId, onEvent }: UseRealtimeOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (eventSourceRef.current) return;

    const url = storeId 
      ? `/api/realtime?storeId=${storeId}`
      : '/api/realtime';

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[Realtime] Connected');
      setIsConnected(true);
    };

    eventSource.onmessage = (e) => {
      try {
        const event: RealtimeEvent = JSON.parse(e.data);
        
        // Handle user presence events
        if (event.type === 'USER_JOINED') {
          setActiveUsers((prev) => {
            if (prev.find((u) => u.id === event.payload.id)) return prev;
            return [...prev, {
              ...event.payload,
              color: generateUserColor(event.payload.name),
              lastActive: new Date(),
            }];
          });
        } else if (event.type === 'USER_LEFT') {
          setActiveUsers((prev) => prev.filter((u) => u.id !== event.payload.id));
        }

        onEvent?.(event);
      } catch (error) {
        console.error('[Realtime] Parse error:', error);
      }
    };

    eventSource.onerror = () => {
      console.log('[Realtime] Connection error, reconnecting...');
      setIsConnected(false);
      eventSource.close();
      eventSourceRef.current = null;

      // Reconnect after delay
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };
  }, [storeId, onEvent]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setIsConnected(false);
  }, []);

  // Broadcast an event to other users
  const broadcast = useCallback(
    async (type: RealtimeEvent['type'], payload: any) => {
      try {
        await fetch('/api/realtime/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, payload, storeId }),
        });
      } catch (error) {
        console.error('[Realtime] Broadcast error:', error);
      }
    },
    [storeId]
  );

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    activeUsers,
    broadcast,
    connect,
    disconnect,
  };
}

// Component to show active users
export function ActiveUsersIndicator({ users }: { users: ActiveUser[] }) {
  if (users.length === 0) return null;

  const displayUsers = users.slice(0, 3);
  const remainingCount = users.length - 3;

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-2">
        {displayUsers.map((user) => (
          <div
            key={user.id}
            className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-white text-xs font-medium">
            +{remainingCount}
          </div>
        )}
      </div>
      <span className="text-xs text-gray-500 ml-2">
        {users.length}명 접속 중
      </span>
    </div>
  );
}

// Connection status indicator
export function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <span className="text-xs text-gray-500">
        {isConnected ? '실시간 연결됨' : '연결 끊김'}
      </span>
    </div>
  );
}
