'use client';

import { useMemo } from 'react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  TrendingUp,
  Calendar,
  BarChart3,
  Target
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  phase: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
  startDate?: string | Date;
  dueDate?: string | Date;
  start_date?: string | Date;
  due_date?: string | Date;
}

interface OpeningReadinessProps {
  tasks: Task[];
  targetOpenDate?: string | Date;
  storeName: string;
}

interface PhaseProgress {
  phase: string;
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  notStarted: number;
  progress: number;
}

export default function OpeningReadiness({ tasks, targetOpenDate, storeName }: OpeningReadinessProps) {
  const analysis = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'DONE').length;
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const blocked = tasks.filter(t => t.status === 'BLOCKED').length;
    const notStarted = tasks.filter(t => t.status === 'NOT_STARTED').length;
    
    const overallProgress = total > 0 ? Math.round((done / total) * 100) : 0;

    // Days until open
    let daysUntilOpen: number | null = null;
    if (targetOpenDate) {
      const openDate = typeof targetOpenDate === 'string' ? parseISO(targetOpenDate) : targetOpenDate;
      daysUntilOpen = differenceInDays(openDate, new Date());
    }

    // Critical path - tasks that are blocked or overdue
    const today = new Date();
    const criticalTasks = tasks.filter(t => {
      if (t.status === 'BLOCKED') return true;
      const due = t.dueDate || t.due_date;
      if (due && t.status !== 'DONE') {
        const dueDate = typeof due === 'string' ? parseISO(due) : due;
        return dueDate < today;
      }
      return false;
    });

    // Group by phase
    const phaseMap: Record<string, PhaseProgress> = {};
    tasks.forEach(t => {
      const phase = t.phase || 'Other';
      if (!phaseMap[phase]) {
        phaseMap[phase] = { phase, total: 0, done: 0, inProgress: 0, blocked: 0, notStarted: 0, progress: 0 };
      }
      phaseMap[phase].total++;
      if (t.status === 'DONE') phaseMap[phase].done++;
      else if (t.status === 'IN_PROGRESS') phaseMap[phase].inProgress++;
      else if (t.status === 'BLOCKED') phaseMap[phase].blocked++;
      else phaseMap[phase].notStarted++;
    });

    Object.values(phaseMap).forEach(p => {
      p.progress = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
    });

    // Calculate readiness score (weighted)
    let readinessScore = overallProgress;
    if (blocked > 0) readinessScore -= (blocked / total) * 20;
    if (criticalTasks.length > 0) readinessScore -= 10;
    readinessScore = Math.max(0, Math.min(100, Math.round(readinessScore)));

    // Readiness status
    let readinessStatus: 'on-track' | 'at-risk' | 'delayed' = 'on-track';
    if (blocked > 0 || criticalTasks.length > total * 0.1) readinessStatus = 'at-risk';
    if (criticalTasks.length > total * 0.25 || blocked > total * 0.1) readinessStatus = 'delayed';

    return {
      total,
      done,
      inProgress,
      blocked,
      notStarted,
      overallProgress,
      daysUntilOpen,
      criticalTasks,
      phases: Object.values(phaseMap).sort((a, b) => b.progress - a.progress),
      readinessScore,
      readinessStatus
    };
  }, [tasks, targetOpenDate]);

  const getStatusColor = () => {
    switch (analysis.readinessStatus) {
      case 'on-track': return 'text-green-600 bg-green-50 border-green-200';
      case 'at-risk': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'delayed': return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const getStatusLabel = () => {
    switch (analysis.readinessStatus) {
      case 'on-track': return 'On Track';
      case 'at-risk': return 'At Risk';
      case 'delayed': return 'Delayed';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Readiness Score */}
        <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Readiness Score</p>
              <p className="text-3xl font-bold mt-1">{analysis.readinessScore}%</p>
            </div>
            <Target className="w-10 h-10 opacity-30" />
          </div>
          <p className="text-sm mt-2">{getStatusLabel()}</p>
        </div>

        {/* Days Until Open */}
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Days Until Open</p>
              <p className="text-3xl font-bold mt-1 text-blue-700">
                {analysis.daysUntilOpen !== null ? analysis.daysUntilOpen : 'TBD'}
              </p>
            </div>
            <Calendar className="w-10 h-10 text-blue-300" />
          </div>
          {analysis.daysUntilOpen !== null && analysis.daysUntilOpen < 0 && (
            <p className="text-sm mt-2 text-red-600">Opening date has passed!</p>
          )}
        </div>

        {/* Task Completion */}
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-3xl font-bold mt-1">{analysis.done}/{analysis.total}</p>
            </div>
            <CheckCircle2 className="w-10 h-10 text-gray-300" />
          </div>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${analysis.overallProgress}%` }}
            />
          </div>
        </div>

        {/* Issues */}
        <div className={`p-4 rounded-lg ${analysis.blocked > 0 ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${analysis.blocked > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                Blocked
              </p>
              <p className={`text-3xl font-bold mt-1 ${analysis.blocked > 0 ? 'text-red-700' : ''}`}>
                {analysis.blocked}
              </p>
            </div>
            <AlertTriangle className={`w-10 h-10 ${analysis.blocked > 0 ? 'text-red-300' : 'text-gray-300'}`} />
          </div>
          {analysis.blocked > 0 && (
            <p className="text-sm mt-2 text-red-600">Needs immediate attention</p>
          )}
        </div>
      </div>

      {/* Task Status Breakdown */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Task Status Overview</h3>
        <div className="flex h-8 rounded-lg overflow-hidden mb-4">
          {analysis.done > 0 && (
            <div 
              className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${(analysis.done / analysis.total) * 100}%` }}
              title={`Done: ${analysis.done}`}
            >
              {analysis.done > 2 && `${analysis.done}`}
            </div>
          )}
          {analysis.inProgress > 0 && (
            <div 
              className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${(analysis.inProgress / analysis.total) * 100}%` }}
              title={`In Progress: ${analysis.inProgress}`}
            >
              {analysis.inProgress > 2 && `${analysis.inProgress}`}
            </div>
          )}
          {analysis.blocked > 0 && (
            <div 
              className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${(analysis.blocked / analysis.total) * 100}%` }}
              title={`Blocked: ${analysis.blocked}`}
            >
              {analysis.blocked > 2 && `${analysis.blocked}`}
            </div>
          )}
          {analysis.notStarted > 0 && (
            <div 
              className="bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-medium"
              style={{ width: `${(analysis.notStarted / analysis.total) * 100}%` }}
              title={`Not Started: ${analysis.notStarted}`}
            >
              {analysis.notStarted > 2 && `${analysis.notStarted}`}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-green-500" />
            <span>Done ({analysis.done})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-blue-500" />
            <span>In Progress ({analysis.inProgress})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-red-500" />
            <span>Blocked ({analysis.blocked})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-gray-300" />
            <span>Not Started ({analysis.notStarted})</span>
          </div>
        </div>
      </div>

      {/* Phase Progress */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Progress by Phase</h3>
        <div className="space-y-4">
          {analysis.phases.map(phase => (
            <div key={phase.phase}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{phase.phase}</span>
                <span className="text-sm text-gray-500">
                  {phase.done}/{phase.total} ({phase.progress}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full flex">
                  <div 
                    className="bg-green-500"
                    style={{ width: `${(phase.done / phase.total) * 100}%` }}
                  />
                  <div 
                    className="bg-blue-500"
                    style={{ width: `${(phase.inProgress / phase.total) * 100}%` }}
                  />
                  <div 
                    className="bg-red-500"
                    style={{ width: `${(phase.blocked / phase.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Critical Tasks */}
      {analysis.criticalTasks.length > 0 && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Critical Tasks ({analysis.criticalTasks.length})
          </h3>
          <div className="space-y-2">
            {analysis.criticalTasks.slice(0, 5).map(task => {
              const due = task.dueDate || task.due_date;
              const isOverdue = due && new Date(due as string) < new Date();
              return (
                <div key={task.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    {task.status === 'BLOCKED' ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-orange-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-gray-500">{task.phase}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {task.status === 'BLOCKED' && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Blocked</span>
                    )}
                    {isOverdue && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Overdue</span>
                    )}
                  </div>
                </div>
              );
            })}
            {analysis.criticalTasks.length > 5 && (
              <p className="text-sm text-red-600 text-center mt-2">
                +{analysis.criticalTasks.length - 5} more critical tasks
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
