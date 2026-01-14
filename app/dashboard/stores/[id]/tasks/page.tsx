'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import TaskList from '@/components/TaskList';
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

interface Milestone {
  id: string;
  name: string;
  date: string;
}

interface Store {
  id: string;
  officialName: string | null;
  tempName: string | null;
  city: string;
  country: string;
}

export default function StoreTasksPage() {
  const params = useParams();
  const storeId = params.id as string;
  const { data: session, status } = useSession();

  const [store, setStore] = useState<Store | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    phase: '',
    mode: 'ALL' as 'ALL' | 'FOCUS'
  });

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
        setMilestones(data.milestones || []);
      } catch {
        notFound();
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session, status, storeId]);

  const handleTaskClick = (task: Task) => {
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

  const handleTaskDelete = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  // Apply filters
  const filteredTasks = tasks.filter(task => {
    if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.phase && task.phase !== filters.phase) {
      return false;
    }
    if (filters.mode === 'FOCUS') {
      const today = new Date();
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      const isOverdue = dueDate && dueDate < today && task.status !== 'DONE' && task.status !== 'COMPLETED';
      const isInProgress = task.status === 'IN_PROGRESS';
      if (!isOverdue && !isInProgress) return false;
    }
    return true;
  });

  // Get unique phases for filter
  const phases = Array.from(new Set(tasks.map(t => t.phase).filter(Boolean))) as string[];

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
            <h1 className="text-3xl font-bold text-gray-900">{storeName} - Tasks</h1>
            <p className="text-gray-600 mt-1">
              {store.city}, {store.country} • {tasks.length} tasks
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

      {/* Simple Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
        <input
          type="text"
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md"
        />
        <select
          value={filters.phase}
          onChange={(e) => setFilters(f => ({ ...f, phase: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">All Phases</option>
          {phases.map(phase => (
            <option key={phase} value={phase}>{phase}</option>
          ))}
        </select>
        <select
          value={filters.mode}
          onChange={(e) => setFilters(f => ({ ...f, mode: e.target.value as 'ALL' | 'FOCUS' }))}
          className="px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="ALL">All Tasks</option>
          <option value="FOCUS">Focus Mode</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow">
        <TaskList
          tasks={filteredTasks}
          onTaskClick={handleTaskClick}
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
