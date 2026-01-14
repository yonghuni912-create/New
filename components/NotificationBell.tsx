'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, X, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

type NotificationType = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  payload?: string;
}

const typeIcons: Record<NotificationType, React.ReactNode> = {
  INFO: <Info className="w-4 h-4 text-blue-500" />,
  WARNING: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  ERROR: <AlertCircle className="w-4 h-4 text-red-500" />,
  SUCCESS: <CheckCircle className="w-4 h-4 text-green-500" />
};

const typeBg: Record<NotificationType, string> = {
  INFO: 'bg-blue-50 border-blue-200',
  WARNING: 'bg-yellow-50 border-yellow-200',
  ERROR: 'bg-red-50 border-red-200',
  SUCCESS: 'bg-green-50 border-green-200'
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString('ko-KR');
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=10');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (notificationIds: string[]) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds })
      });
      setNotifications(prev =>
        prev.map(n => notificationIds.includes(n.id) ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true })
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
    setIsLoading(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-full transition-colors"
        aria-label="알림"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[70vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-800">알림</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={isLoading}
                  className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 disabled:opacity-50"
                >
                  <CheckCheck className="w-3 h-3" />
                  모두 읽음
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>알림이 없습니다</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map(notification => (
                  <li
                    key={notification.id}
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.isRead ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => {
                      if (!notification.isRead) markAsRead([notification.id]);
                    }}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {typeIcons[notification.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimeAgo(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t bg-gray-50 text-center">
              <a
                href="/dashboard/notifications"
                className="text-sm text-red-600 hover:text-red-800"
              >
                모든 알림 보기
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
