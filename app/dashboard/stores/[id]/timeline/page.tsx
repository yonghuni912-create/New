import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowLeft, Calendar, CheckCircle2, Clock, AlertCircle, PlayCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default async function StoreTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      plannedOpenDates: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      tasks: {
        orderBy: [{ startDate: 'asc' }, { dueDate: 'asc' }],
      },
    },
  });

  if (!store) {
    notFound();
  }

  const storeName = store.officialName || store.tempName || 'Unnamed Store';
  const openDate = store.plannedOpenDates[0]?.date;
  const today = new Date();

  // Group tasks by phase
  const tasksByPhase = store.tasks.reduce((acc: Record<string, typeof store.tasks>, task) => {
    const phase = task.phase || 'Other';
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(task);
    return acc;
  }, {});

  // Get unique phases in order
  const phases = Object.keys(tasksByPhase);

  // Calculate progress
  const totalTasks = store.tasks.length;
  const completedTasks = store.tasks.filter(t => t.status === 'DONE' || t.status === 'COMPLETED').length;
  const inProgressTasks = store.tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getStatusIcon = (status: string, isOverdue: boolean) => {
    if (status === 'DONE' || status === 'COMPLETED') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (status === 'IN_PROGRESS') return <PlayCircle className="w-4 h-4 text-blue-500" />;
    if (isOverdue) return <AlertCircle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href={`/dashboard/stores/${store.id}`}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{storeName} - Timeline</h1>
            <p className="text-gray-600 mt-1">
              {store.city}, {store.country}
              {openDate && (
                <span className="ml-4 text-orange-600 font-medium">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Open Date: {format(openDate, 'MMM d, yyyy')}
                  <span className="text-gray-500 ml-2">
                    ({differenceInDays(openDate, today) >= 0 
                      ? `${differenceInDays(openDate, today)} days remaining`
                      : `${Math.abs(differenceInDays(openDate, today))} days ago`})
                  </span>
                </span>
              )}
            </p>
          </div>
        </div>
        {totalTasks === 0 && openDate && (
          <form action={`/api/stores/${store.id}/generate-tasks`} method="POST">
            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium"
            >
              Generate Timeline Tasks
            </button>
          </form>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Tasks</div>
          <div className="text-2xl font-bold text-gray-900">{totalTasks}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Completed</div>
          <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500">In Progress</div>
          <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Progress</div>
          <div className="text-2xl font-bold text-orange-600">{progressPercent}%</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Overall Progress</h3>
          <span className="text-sm text-gray-600">{completedTasks} / {totalTasks} tasks completed</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-orange-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Timeline by Phase */}
      {totalTasks === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No tasks generated yet for this store.</p>
          {openDate ? (
            <p className="text-sm text-gray-400">
              Click "Generate Timeline Tasks" above to create tasks based on the planned open date.
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              Set a planned open date first to generate the timeline tasks.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {phases.map((phase) => {
            const phaseTasks = tasksByPhase[phase];
            const phaseCompleted = phaseTasks.filter(t => t.status === 'DONE' || t.status === 'COMPLETED').length;
            const phaseProgress = Math.round((phaseCompleted / phaseTasks.length) * 100);
            
            // Get date range for phase
            const startDate = phaseTasks[0]?.startDate;
            const endDate = phaseTasks[phaseTasks.length - 1]?.dueDate;

            return (
              <div key={phase} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Phase Header */}
                <div className="bg-gradient-to-r from-orange-50 to-white px-6 py-4 border-b border-orange-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{phase}</h3>
                      <p className="text-sm text-gray-500">
                        {phaseTasks.length} tasks • {phaseCompleted} completed
                        {startDate && endDate && (
                          <span className="ml-2 text-gray-400">
                            ({format(startDate, 'MMM d')} - {format(endDate, 'MMM d')})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-orange-600">{phaseProgress}%</span>
                    </div>
                  </div>
                  {/* Phase Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                    <div 
                      className="bg-orange-400 h-2 rounded-full"
                      style={{ width: `${phaseProgress}%` }}
                    />
                  </div>
                </div>

                {/* Tasks */}
                <div className="divide-y divide-gray-100">
                  {phaseTasks.map((task) => {
                    const isOverdue = task.dueDate && new Date(task.dueDate) < today && task.status !== 'DONE' && task.status !== 'COMPLETED';
                    const isMilestone = task.priority === 'HIGH';
                    
                    return (
                      <div 
                        key={task.id} 
                        className={`px-6 py-4 hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(task.status, isOverdue)}
                            
                            {/* Task Info */}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${task.status === 'DONE' || task.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                  {isMilestone && '🎯 '}
                                  {task.title}
                                </span>
                                {isMilestone && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                    Milestone
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                {task.calendarRule && (
                                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                                    {task.calendarRule === 'BUSINESS_DAYS_MON_FRI' ? '📅 Business Days' : '📆 Calendar Days'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Dates */}
                          <div className="text-right">
                            <div className={`font-mono text-sm ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                              {task.startDate && format(task.startDate, 'MMM d')}
                              {task.startDate && task.dueDate && ' → '}
                              {task.dueDate && format(task.dueDate, 'MMM d')}
                            </div>
                            {openDate && task.startDate && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                D{differenceInDays(task.startDate, openDate) >= 0 ? '+' : ''}{differenceInDays(task.startDate, openDate)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
