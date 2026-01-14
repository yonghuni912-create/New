'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface TaskListProps {
  tasks: any[];
  onTaskClick: (task: any) => void;
}

export default function TaskList({ tasks, onTaskClick }: TaskListProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const togglePhase = (phase: string) => {
    setCollapsed(prev => ({ ...prev, [phase]: !prev[phase] }));
  };

  // Group by phase
  const grouped = tasks.reduce((acc, task) => {
    const p = task.phase || 'Uncategorized';
    if (!acc[p]) acc[p] = [];
    acc[p].push(task);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedPhases = Object.keys(grouped).sort();

  if (tasks.length === 0) {
    return (
      <div className="p-12 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
        <p className="text-slate-500">No tasks found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedPhases.map(phase => {
        const phaseTasks = grouped[phase].sort((a: any, b: any) =>
          (new Date(a.startDate || a.start_date || 0).getTime()) - (new Date(b.startDate || b.start_date || 0).getTime())
        );
        const isCollapsed = collapsed[phase];
        const startDate = phaseTasks[0]?.startDate || phaseTasks[0]?.start_date;
        const endDate = phaseTasks[phaseTasks.length - 1]?.dueDate || phaseTasks[phaseTasks.length - 1]?.due_date;
        const completedCount = phaseTasks.filter((t: any) => t.status === 'DONE' || t.status === 'COMPLETED').length;

        return (
          <Card key={phase} className="overflow-hidden">
            <div
              className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-white cursor-pointer hover:bg-orange-50"
              onClick={() => togglePhase(phase)}
            >
              <div className="flex items-center gap-3">
                {isCollapsed ? (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
                <div>
                  <h3 className="font-bold text-slate-800">{phase}</h3>
                  <span className="text-xs text-slate-500">
                    {completedCount}/{phaseTasks.length} completed
                  </span>
                </div>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {startDate && endDate ? `${format(new Date(startDate), 'MMM d')} - ${format(new Date(endDate), 'MMM d')}` : ''}
              </div>
            </div>

            {!isCollapsed && (
              <div className="divide-y divide-slate-100">
                {phaseTasks.map((task: any) => {
                  const taskStartDate = task.startDate || task.start_date;
                  const taskDueDate = task.dueDate || task.due_date;
                  const isOverdue = taskDueDate && new Date(taskDueDate) < new Date() && task.status !== 'DONE' && task.status !== 'COMPLETED';
                  const isMilestone = task.priority === 'HIGH' || task.is_milestone;

                  return (
                    <div
                      key={task.id}
                      className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${isOverdue ? 'bg-red-50' : ''}`}
                      onClick={() => onTaskClick(task)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Status indicator */}
                          <div className={`w-3 h-3 rounded-full ${
                            task.status === 'DONE' || task.status === 'COMPLETED' ? 'bg-green-500' :
                            task.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                            isOverdue ? 'bg-red-500' :
                            'bg-slate-300'
                          }`} />

                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${task.status === 'DONE' || task.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                {isMilestone && '🎯 '}
                                {task.title}
                              </span>
                              {isMilestone && (
                                <Badge variant="info">Milestone</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                              {task.calendarRule && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded">
                                  {task.calendarRule === 'BUSINESS_DAYS_MON_FRI' ? '📅 Business Days' : '📆 Calendar Days'}
                                </span>
                              )}
                              {task.roleResponsible && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                                  {task.roleResponsible}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`font-mono text-sm ${isOverdue ? 'text-red-600' : 'text-slate-600'}`}>
                            {taskStartDate && format(new Date(taskStartDate), 'MMM d')}
                            {taskStartDate && taskDueDate && ' → '}
                            {taskDueDate && format(new Date(taskDueDate), 'MMM d')}
                          </div>
                          <Badge
                            variant={
                              task.status === 'DONE' || task.status === 'COMPLETED' ? 'success' :
                              task.status === 'IN_PROGRESS' ? 'info' :
                              isOverdue ? 'error' :
                              'default'
                            }
                            className="mt-1"
                          >
                            {task.status?.replace('_', ' ') || 'NOT STARTED'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
