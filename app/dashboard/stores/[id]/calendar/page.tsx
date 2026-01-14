'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CalendarView from '@/components/CalendarView';
import TaskEditModal from '@/components/TaskEditModal';
import TaskCreateModal from '@/components/TaskCreateModal';

interface Task {
  id: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  status: string;
  phase?: string;
}

interface Store {
  id: string;
  officialName: string | null;
  tempName: string | null;
  city: string;
  country: string;
}

export default function StoreCalendarPage() {
  const params = useParams();
  const storeId = params.id as string;
  const { data: session, status } = useSession();

  const [store, setStore] = useState<Store | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      redirect('/login');
    }

    async function fetchData() {
      try {
        const res = await fetch(`/api/stores/${storeId}`);
        if (!res.ok) throw new Error('Store not found');
        const data = await res.json();
        setStore(data);
        setTasks(data.tasks || []);
      } catch {
        notFound();
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session, status, storeId]);

  const handleEventDrop = async ({ event, start, end }: { event: any; start: Date; end: Date }) => {
    const taskId = event.id || event.resource?.id;
    if (!taskId) return;
    
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start.toISOString(),
          dueDate: end.toISOString(),
          reschedulePolicy: 'THIS_ONLY'
        })
      });
      
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, startDate: start.toISOString(), dueDate: end.toISOString() }
          : t
      ));
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleEventClick = (task: Task) => {
    setSelectedTask(task);
    setIsEditModalOpen(true);
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleTaskCreate = async (taskData: Partial<Task>) => {
    try {
      const res = await fetch(`/api/stores/${storeId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      const newTask = await res.json();
      setTasks(prev => [...prev, newTask]);
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Failed to create task:', error);
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

  const storeName = store.officialName || store.tempName || 'Unnamed Store';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href={`/dashboard/stores/${storeId}`}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{storeName} - Calendar</h1>
            <p className="text-gray-600 mt-1">
              {store.city}, {store.country}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium"
        >
          + Add Task
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <CalendarView
          tasks={tasks}
          onEventDrop={handleEventDrop}
          onEventClick={handleEventClick}
        />
      </div>

      {selectedTask && (
        <TaskEditModal
          task={selectedTask}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleTaskUpdate}
        />
      )}

      <TaskCreateModal
        storeId={storeId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleTaskCreate}
      />
    </div>
  );
}
