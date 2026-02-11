'use client';

import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, Link2, X, AlertTriangle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: string;
  dependencies?: string[];
  dependents?: string[];
}

interface TaskDependencyProps {
  task: Task;
  allTasks: Task[];
  onAddDependency: (fromTaskId: string, toTaskId: string) => Promise<void>;
  onRemoveDependency: (fromTaskId: string, toTaskId: string) => Promise<void>;
  disabled?: boolean;
}

export function TaskDependency({
  task,
  allTasks,
  onAddDependency,
  onRemoveDependency,
  disabled = false,
}: TaskDependencyProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const dependencies = useMemo(
    () => allTasks.filter((t) => task.dependencies?.includes(t.id)),
    [allTasks, task.dependencies]
  );

  const dependents = useMemo(
    () => allTasks.filter((t) => task.dependents?.includes(t.id)),
    [allTasks, task.dependents]
  );

  // Tasks that can be added as dependencies (excluding self and existing dependencies)
  const availableTasks = useMemo(() => {
    const excludeIds = new Set([task.id, ...(task.dependencies || [])]);
    return allTasks.filter((t) => !excludeIds.has(t.id));
  }, [allTasks, task]);

  const handleAddDependency = useCallback(
    async (dependencyId: string) => {
      if (disabled || loading) return;
      setLoading(true);
      try {
        await onAddDependency(task.id, dependencyId);
        setShowAddModal(false);
      } finally {
        setLoading(false);
      }
    },
    [disabled, loading, onAddDependency, task.id]
  );

  const handleRemoveDependency = useCallback(
    async (dependencyId: string) => {
      if (disabled || loading) return;
      setLoading(true);
      try {
        await onRemoveDependency(task.id, dependencyId);
      } finally {
        setLoading(false);
      }
    },
    [disabled, loading, onRemoveDependency, task.id]
  );

  // Check for circular dependency
  const hasCircularDependency = useMemo(() => {
    const visited = new Set<string>();
    const stack = [...(task.dependencies || [])];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (visited.has(currentId)) continue;
      if (currentId === task.id) return true;
      visited.add(currentId);

      const current = allTasks.find((t) => t.id === currentId);
      if (current?.dependencies) {
        stack.push(...current.dependencies);
      }
    }
    return false;
  }, [allTasks, task]);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <Link2 className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-700">의존성</span>
          {dependencies.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
              {dependencies.length}개 선행 타스크
            </span>
          )}
        </div>
        {hasCircularDependency && (
          <div className="flex items-center gap-1 text-red-600 text-sm">
            <AlertTriangle className="w-4 h-4" />
            순환 의존성
          </div>
        )}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Dependencies (tasks that must be completed before this one) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">
                선행 타스크 (이 타스크 전에 완료되어야 함)
              </h4>
              {!disabled && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="text-sm text-orange-600 hover:text-orange-700"
                >
                  + 추가
                </button>
              )}
            </div>
            {dependencies.length === 0 ? (
              <p className="text-sm text-gray-500">선행 타스크가 없습니다</p>
            ) : (
              <ul className="space-y-2">
                {dependencies.map((dep) => (
                  <li
                    key={dep.id}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          dep.status === 'COMPLETED'
                            ? 'bg-green-500'
                            : 'bg-gray-400'
                        }`}
                      />
                      <span className="text-sm">{dep.title}</span>
                      {dep.status !== 'COMPLETED' && (
                        <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                          미완료
                        </span>
                      )}
                    </div>
                    {!disabled && (
                      <button
                        onClick={() => handleRemoveDependency(dep.id)}
                        disabled={loading}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Dependents (tasks that depend on this one) */}
          {dependents.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                후속 타스크 (이 타스크 완료 후 시작 가능)
              </h4>
              <ul className="space-y-2">
                {dependents.map((dep) => (
                  <li
                    key={dep.id}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg"
                  >
                    <span className="text-sm">{dep.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Add Dependency Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[60vh] overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">선행 타스크 추가</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {availableTasks.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  추가할 수 있는 타스크가 없습니다
                </p>
              ) : (
                <ul className="space-y-2">
                  {availableTasks.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => handleAddDependency(t.id)}
                        disabled={loading}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            t.status === 'COMPLETED'
                              ? 'bg-green-500'
                              : 'bg-gray-400'
                          }`}
                        />
                        <span className="text-sm">{t.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// API endpoint for managing dependencies
export async function addTaskDependency(taskId: string, dependencyId: string) {
  const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dependencyId }),
  });
  if (!res.ok) throw new Error('Failed to add dependency');
  return res.json();
}

export async function removeTaskDependency(taskId: string, dependencyId: string) {
  const res = await fetch(`/api/tasks/${taskId}/dependencies/${dependencyId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove dependency');
  return res.json();
}
