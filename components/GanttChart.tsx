'use client';

import { useMemo, useState } from 'react';
import { format, addDays, differenceInDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

interface GanttTask {
  id: string;
  title: string;
  phase?: string;
  startDate?: string | Date | null;
  dueDate?: string | Date | null;
  start_date?: string | Date | null;
  due_date?: string | Date | null;
  status: string;
  priority?: string;
}

interface GanttChartProps {
  tasks: GanttTask[];
  onTaskClick?: (task: GanttTask) => void;
  startDate?: Date;
  endDate?: Date;
}

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-gray-300',
  IN_PROGRESS: 'bg-blue-500',
  DONE: 'bg-green-500',
  BLOCKED: 'bg-red-500',
};

const PRIORITY_BORDERS: Record<string, string> = {
  LOW: 'border-gray-400',
  MEDIUM: 'border-yellow-400',
  HIGH: 'border-orange-500',
  URGENT: 'border-red-600',
};

export default function GanttChart({ tasks, onTaskClick, startDate: propStartDate, endDate: propEndDate }: GanttChartProps) {
  const [zoom, setZoom] = useState<'day' | 'week'>('day');
  const [viewOffset, setViewOffset] = useState(0);

  // Calculate date range from tasks
  const { chartStartDate, chartEndDate, days } = useMemo(() => {
    const now = new Date();
    let minDate = propStartDate || now;
    let maxDate = propEndDate || addDays(now, 30);

    tasks.forEach(task => {
      const start = task.startDate || task.start_date;
      const end = task.dueDate || task.due_date;
      
      if (start) {
        const startD = typeof start === 'string' ? parseISO(start) : start;
        if (startD < minDate) minDate = startD;
      }
      if (end) {
        const endD = typeof end === 'string' ? parseISO(end) : end;
        if (endD > maxDate) maxDate = endD;
      }
    });

    // Add padding
    minDate = addDays(minDate, -3 + viewOffset);
    maxDate = addDays(maxDate, 7 + viewOffset);

    const days = eachDayOfInterval({ start: minDate, end: maxDate });
    return { chartStartDate: minDate, chartEndDate: maxDate, days };
  }, [tasks, propStartDate, propEndDate, viewOffset]);

  // Group tasks by phase
  const tasksByPhase = useMemo(() => {
    const grouped: Record<string, GanttTask[]> = {};
    tasks.forEach(task => {
      const phase = task.phase || 'Other';
      if (!grouped[phase]) grouped[phase] = [];
      grouped[phase].push(task);
    });
    return grouped;
  }, [tasks]);

  const phases = Object.keys(tasksByPhase);

  const getTaskPosition = (task: GanttTask) => {
    const start = task.startDate || task.start_date;
    const end = task.dueDate || task.due_date;
    
    if (!start || !end) return null;

    const startD = typeof start === 'string' ? parseISO(start) : start;
    const endD = typeof end === 'string' ? parseISO(end) : end;
    
    const startOffset = differenceInDays(startD, chartStartDate);
    const duration = differenceInDays(endD, startD) + 1;
    
    const cellWidth = zoom === 'day' ? 40 : 20;
    const left = startOffset * cellWidth;
    const width = duration * cellWidth - 4;
    
    return { left: Math.max(0, left), width: Math.max(20, width) };
  };

  const today = new Date();
  const todayIndex = days.findIndex(d => isSameDay(d, today));
  const cellWidth = zoom === 'day' ? 40 : 20;

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewOffset(v => v - 7)}
            className="p-1.5 rounded hover:bg-gray-200"
            title="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewOffset(0)}
            className="px-3 py-1 text-sm rounded hover:bg-gray-200"
          >
            Today
          </button>
          <button
            onClick={() => setViewOffset(v => v + 7)}
            className="p-1.5 rounded hover:bg-gray-200"
            title="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(zoom === 'day' ? 'week' : 'day')}
            className="flex items-center gap-1 px-3 py-1 text-sm rounded hover:bg-gray-200"
          >
            {zoom === 'day' ? (
              <>
                <ZoomOut className="w-4 h-4" /> Week View
              </>
            ) : (
              <>
                <ZoomIn className="w-4 h-4" /> Day View
              </>
            )}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="flex overflow-x-auto">
        {/* Task names column */}
        <div className="flex-shrink-0 w-64 border-r bg-gray-50">
          {/* Header for phases/tasks */}
          <div className="h-14 border-b px-4 flex items-center">
            <span className="font-semibold text-gray-700">Tasks</span>
          </div>
          
          {phases.map(phase => (
            <div key={phase}>
              {/* Phase header */}
              <div className="h-8 px-4 flex items-center bg-gray-100 border-b">
                <span className="text-sm font-medium text-gray-600">{phase}</span>
                <span className="ml-2 text-xs text-gray-400">({tasksByPhase[phase].length})</span>
              </div>
              {/* Tasks in phase */}
              {tasksByPhase[phase].map(task => (
                <div
                  key={task.id}
                  className="h-10 px-4 flex items-center border-b hover:bg-gray-100 cursor-pointer truncate"
                  onClick={() => onTaskClick?.(task)}
                >
                  <span className={`w-2 h-2 rounded-full mr-2 ${STATUS_COLORS[task.status]}`} />
                  <span className="text-sm truncate">{task.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-x-auto">
          {/* Date headers */}
          <div className="flex h-14 border-b">
            {days.map((day, idx) => {
              const isToday = isSameDay(day, today);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              
              return (
                <div
                  key={idx}
                  className={`flex-shrink-0 border-r flex flex-col items-center justify-center text-xs
                    ${isToday ? 'bg-orange-100' : isWeekend ? 'bg-gray-100' : 'bg-white'}`}
                  style={{ width: cellWidth }}
                >
                  <span className="text-gray-500">{format(day, 'EEE')}</span>
                  <span className={`font-medium ${isToday ? 'text-orange-600' : ''}`}>
                    {format(day, 'd')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {phases.map(phase => (
            <div key={phase}>
              {/* Phase row */}
              <div className="flex h-8 bg-gray-100 border-b">
                {days.map((day, idx) => (
                  <div
                    key={idx}
                    className="flex-shrink-0 border-r"
                    style={{ width: cellWidth }}
                  />
                ))}
              </div>
              {/* Task rows */}
              {tasksByPhase[phase].map(task => {
                const pos = getTaskPosition(task);
                const isWeekendDay = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
                
                return (
                  <div key={task.id} className="relative flex h-10 border-b">
                    {days.map((day, idx) => (
                      <div
                        key={idx}
                        className={`flex-shrink-0 border-r ${
                          isSameDay(day, today) ? 'bg-orange-50' : isWeekendDay(day) ? 'bg-gray-50' : ''
                        }`}
                        style={{ width: cellWidth }}
                      />
                    ))}
                    {/* Task bar */}
                    {pos && (
                      <div
                        className={`absolute top-1.5 h-7 rounded ${STATUS_COLORS[task.status]} 
                          border-2 ${PRIORITY_BORDERS[task.priority || 'MEDIUM']}
                          hover:opacity-80 cursor-pointer transition-opacity
                          flex items-center px-2 text-white text-xs font-medium overflow-hidden`}
                        style={{ left: pos.left, width: pos.width }}
                        onClick={() => onTaskClick?.(task)}
                        title={`${task.title}\n${task.status}`}
                      >
                        <span className="truncate">{task.title}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Today line */}
          {todayIndex >= 0 && (
            <div
              className="absolute top-14 bottom-0 w-0.5 bg-orange-500 pointer-events-none z-10"
              style={{ left: 256 + todayIndex * cellWidth + cellWidth / 2 }}
            />
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t bg-gray-50 text-xs">
        <span className="text-gray-500">Status:</span>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-300" />
          <span>Not Started</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-500" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500" />
          <span>Done</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500" />
          <span>Blocked</span>
        </div>
      </div>
    </div>
  );
}
