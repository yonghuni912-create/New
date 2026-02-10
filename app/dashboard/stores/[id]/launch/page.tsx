'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import LaunchTaskManagement from '@/components/LaunchTaskManagement';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  category: string | null;
  subcategory: string | null;
  durationDays: number;
  daysBeforeOpening: number | null;
  orderIndex: number;
  isMilestone: boolean;
  assignee: { id: string; name: string; email: string } | null;
  _count: { comments: number };
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Store {
  id: string;
  storeName: string;
  storeCode: string;
  city: string;
  country: string;
  plannedOpenDate: string | null;
  tasks: Task[];
}

export default function StoreLaunchSchedulePage() {
  const params = useParams();
  const storeId = params.id as string;
  const { data: session, status } = useSession();

  const [store, setStore] = useState<Store | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [storeRes, usersRes] = await Promise.all([
        fetch(`/api/stores/${storeId}`),
        fetch('/api/users'),
      ]);
      
      if (!storeRes.ok) throw new Error('Store not found');
      const storeData = await storeRes.json();
      setStore(storeData);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || usersData || []);
      }
    } catch {
      notFound();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      redirect('/login');
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, storeId]);

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleReschedule = async (taskId: string, deltaDays: number, mode: string) => {
    try {
      await fetch('/api/tasks/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          taskId,
          deltaDays,
          mode,
        }),
      });
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Failed to reschedule tasks:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!store) {
    return notFound();
  }

  const storeName = store.storeName || store.storeCode || 'Unnamed Store';
  const hasTasks = store.tasks.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href={`/dashboard/stores/${storeId}`}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{storeName} - 런칭 스케줄</h1>
            <p className="text-gray-600 mt-1">
              {store.city}, {store.country}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/stores/${storeId}/tasks`}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            기존 타스크 뷰
          </Link>
          <Link
            href="/dashboard/stores/templates"
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
            템플릿 관리
          </Link>
        </div>
      </div>

      {!hasTasks ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">타스크가 없습니다</h2>
            <p className="text-gray-600 mb-6">
              {store.plannedOpenDate 
                ? '오픈 예정일을 기준으로 런칭 타스크를 자동 생성할 수 있습니다.'
                : '먼저 오픈 예정일을 설정해주세요.'}
            </p>
            {store.plannedOpenDate ? (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/stores/${storeId}/generate-tasks`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ templateName: 'DEFAULT' }),
                    });
                    if (res.ok) {
                      fetchData();
                    } else {
                      const data = await res.json();
                      alert(data.error || '타스크 생성에 실패했습니다.');
                    }
                  } catch (error) {
                    console.error('Failed to generate tasks:', error);
                  }
                }}
                className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                런칭 타스크 자동 생성
              </button>
            ) : (
              <Link
                href={`/dashboard/stores/${storeId}`}
                className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                오픈 예정일 설정
              </Link>
            )}
          </div>
        </div>
      ) : (
        <LaunchTaskManagement
          storeId={storeId}
          storeName={storeName}
          openDate={store.plannedOpenDate}
          tasks={store.tasks}
          users={users}
          onTaskUpdate={handleTaskUpdate}
          onReschedule={handleReschedule}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}
