'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import TaskList from '@/components/TaskList';
import TaskEditModal from '@/components/TaskEditModal';
import TaskCreateModal from '@/components/TaskCreateModal';
import ViewControls from '@/components/ViewControls';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { format } from 'date-fns';

const CalendarView = dynamic(() => import('@/components/CalendarView'), { ssr: false });

interface StoreDetailClientProps {
  store: any;
}

export default function StoreDetailClient({ store }: StoreDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<'TIMELINE' | 'CALENDAR'>('TIMELINE');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
  };

  const handleEventDrop = ({ event, start }: { event: any; start: Date; end: Date }) => {
    const updatedTask = {
      ...event.resource,
      startDate: start.toISOString()
    };
    setSelectedTask(updatedTask);
  };

  const handleSave = async (id: string, updates: any) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to update task');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving task');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to delete task');
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting task');
    }
  };

  // Get unique phases
  const phases = useMemo(() => {
    const set = new Set(store.tasks.map((t: any) => t.phase || 'Uncategorized'));
    return Array.from(set).sort() as string[];
  }, [store.tasks]);

  // Filter Logic
  const filteredTasks = useMemo(() => {
    const filterPhase = searchParams.get('phase') || '';
    const filterSearch = searchParams.get('search')?.toLowerCase() || '';
    const mode = searchParams.get('mode') || 'ALL';

    return store.tasks.filter((t: any) => {
      if (filterPhase && t.phase !== filterPhase) return false;
      if (filterSearch && !t.title.toLowerCase().includes(filterSearch)) return false;
      if (mode === 'FOCUS') {
        return t.priority === 'HIGH' || t.status === 'IN_PROGRESS';
      }
      return true;
    });
  }, [store.tasks, searchParams]);

  // Stats
  const totalTasks = store.tasks.length;
  const completedTasks = store.tasks.filter((t: any) => t.status === 'DONE' || t.status === 'COMPLETED').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <Link href="/dashboard/stores" className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors">
            ← Back to Stores
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
            {store.officialName || store.tempName || 'Unnamed Store'}
          </h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{store.city}, {store.country}</span>
            <span>•</span>
            <span>Open: {store.plannedOpenDates?.[0]?.date
              ? format(new Date(store.plannedOpenDates[0].date), 'MMM d, yyyy')
              : 'N/A'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-md flex">
            <button
              onClick={() => setView('TIMELINE')}
              className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-all ${view === 'TIMELINE' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Timeline
            </button>
            <button
              onClick={() => setView('CALENDAR')}
              className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-all ${view === 'CALENDAR' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Calendar
            </button>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            + New Task
          </Button>
        </div>
      </div>

      <ViewControls phases={phases} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Stats */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-100">
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-orange-800 uppercase tracking-wider mb-1">Status</div>
              <div className="text-2xl font-bold text-slate-900">{store.status}</div>
              <div className="mt-4 pt-4 border-t border-orange-100 flex justify-between text-sm">
                <span className="text-slate-600">Tasks</span>
                <span className="font-mono font-medium">{filteredTasks.length} / {store.tasks.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <div className="p-4 border-b border-slate-100 font-semibold text-slate-700">Progress</div>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">{completedTasks} / {totalTasks}</span>
                <span className="text-sm font-bold text-orange-600">{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <div className="p-4 border-b border-slate-100 font-semibold text-slate-700">Milestones</div>
            <ul className="divide-y divide-slate-100">
              {store.milestones && store.milestones.length > 0 ? (
                store.milestones.map((m: any) => (
                  <li key={m.id} className="p-3 hover:bg-slate-50 transition-colors flex justify-between items-center text-sm">
                    <span className="text-slate-600">{m.type}</span>
                    <Badge variant={m.status === 'ACHIEVED' ? 'success' : 'default'}>
                      {format(new Date(m.date), 'MMM d')}
                    </Badge>
                  </li>
                ))
              ) : (
                <li className="p-3 text-sm text-slate-400 text-center">No milestones</li>
              )}
            </ul>
          </Card>
        </div>

        {/* Main View */}
        <div className="lg:col-span-3">
          {view === 'TIMELINE' ? (
            <TaskList tasks={filteredTasks} onTaskClick={handleTaskClick} />
          ) : (
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 min-h-[600px]">
              <CalendarView
                tasks={filteredTasks}
                onEventClick={handleTaskClick}
                onEventDrop={handleEventDrop}
              />
            </div>
          )}
        </div>
      </div>

      {/* Task Edit Modal */}
      {selectedTask && (
        <TaskEditModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {/* Task Create Modal */}
      {showCreateModal && (
        <TaskCreateModal
          storeId={store.id}
          phases={phases}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  );
}
