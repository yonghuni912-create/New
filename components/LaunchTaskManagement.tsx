'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { format, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import TaskCommentsModal from './TaskCommentsModal';
import {
  Calendar,
  Clock,
  User,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  XCircle,
  Filter,
  Search,
} from 'lucide-react';

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

interface LaunchTaskManagementProps {
  storeId: string;
  storeName: string;
  openDate: string | null;
  tasks: Task[];
  users: User[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onReschedule: (taskId: string, deltaDays: number, mode: string) => Promise<void>;
  onRefresh: () => void;
}

// Task status configuration
const STATUS_CONFIG = {
  TODO: { label: '대기', icon: Clock, color: 'gray', bgColor: 'bg-gray-100', textColor: 'text-gray-700' },
  IN_PROGRESS: { label: '진행중', icon: PlayCircle, color: 'blue', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
  DONE: { label: '완료', icon: CheckCircle2, color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-700' },
  COMPLETED: { label: '완료', icon: CheckCircle2, color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-700' },
  ON_HOLD: { label: '보류', icon: PauseCircle, color: 'yellow', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
  BLOCKED: { label: '차단됨', icon: AlertCircle, color: 'red', bgColor: 'bg-red-100', textColor: 'text-red-700' },
  CANCELLED: { label: '취소', icon: XCircle, color: 'gray', bgColor: 'bg-gray-200', textColor: 'text-gray-500' },
};

const RESCHEDULE_MODES = [
  { value: 'SINGLE', label: '이 타스크만', description: '선택한 타스크만 일정 변경' },
  { value: 'ALL_BEFORE', label: '이전 타스크 포함', description: '선택한 타스크와 이전 모든 타스크 일정 변경' },
  { value: 'ALL_AFTER', label: '이후 타스크 포함', description: '선택한 타스크와 이후 모든 타스크 일정 변경' },
  { value: 'ALL', label: '모든 타스크', description: '모든 타스크 일정 변경' },
];

export default function LaunchTaskManagement({
  storeId,
  storeName,
  openDate,
  tasks,
  users,
  onTaskUpdate,
  onReschedule,
  onRefresh,
}: LaunchTaskManagementProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: session } = useSession();
  const [rescheduleData, setRescheduleData] = useState({ deltaDays: 0, mode: 'SINGLE' });

  const today = new Date();
  const openDateObj = openDate ? new Date(openDate) : null;
  const daysUntilOpen = openDateObj ? differenceInDays(openDateObj, today) : null;

  // Group tasks by category
  const tasksByCategory = tasks.reduce<Record<string, Task[]>>((acc, task) => {
    const category = task.category || '기타';
    if (!acc[category]) acc[category] = [];
    acc[category].push(task);
    return acc;
  }, {});

  // Get unique categories for filter
  const categories = Object.keys(tasksByCategory);

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filterCategory !== 'ALL' && task.category !== filterCategory) return false;
    if (filterStatus !== 'ALL' && task.status !== filterStatus) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Calculate stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'DONE' || t.status === 'COMPLETED').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const overdueTasks = tasks.filter((t) => {
    if (t.status === 'DONE' || t.status === 'COMPLETED') return false;
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < today;
  }).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const expandAllCategories = () => {
    setExpandedCategories(new Set(categories));
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    await onTaskUpdate(task.id, { status: newStatus } as unknown as Partial<Task>);
  };

  const handleAssigneeChange = async (task: Task, assigneeId: string | null) => {
    await onTaskUpdate(task.id, { assigneeId } as unknown as Partial<Task>);
  };

  const handleRescheduleSubmit = async () => {
    if (!selectedTask) return;
    await onReschedule(selectedTask.id, rescheduleData.deltaDays, rescheduleData.mode);
    setShowRescheduleModal(false);
    setRescheduleData({ deltaDays: 0, mode: 'SINGLE' });
    onRefresh();
  };

  const handleExportExcel = () => {
    window.location.href = `/api/stores/${storeId}/tasks/export`;
  };

  const getTaskStatusInfo = (task: Task) => {
    const config = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.TODO;
    const isOverdue = task.dueDate && new Date(task.dueDate) < today && task.status !== 'DONE' && task.status !== 'COMPLETED';
    return { ...config, isOverdue };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">런칭 스케줄 관리</h2>
          <p className="text-gray-600">
            {storeName}
            {openDateObj && (
              <span className="ml-2 text-orange-600 font-medium">
                오픈 예정일: {format(openDateObj, 'yyyy년 M월 d일', { locale: ko })}
                <span className="text-gray-500 ml-2">
                  ({daysUntilOpen !== null && daysUntilOpen >= 0 
                    ? `D-${daysUntilOpen}` 
                    : `D+${Math.abs(daysUntilOpen || 0)}`})
                </span>
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Excel 내보내기
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500">전체 타스크</div>
          <div className="text-2xl font-bold text-gray-900">{totalTasks}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500">완료</div>
          <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500">진행중</div>
          <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500">지연</div>
          <div className="text-2xl font-bold text-red-600">{overdueTasks}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500">진행률</div>
          <div className="text-2xl font-bold text-orange-600">{progressPercent}%</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-orange-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="타스크 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">모든 카테고리</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">모든 상태</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <button
              onClick={expandAllCategories}
              className="px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg"
            >
              모두 펼치기
            </button>
          </div>
        </div>
      </div>

      {/* Tasks by Category */}
      <div className="space-y-4">
        {Object.entries(tasksByCategory).map(([category, categoryTasks]) => {
          const filteredCategoryTasks = categoryTasks.filter((task) => {
            if (filterStatus !== 'ALL' && task.status !== filterStatus) return false;
            if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
          });

          if (filteredCategoryTasks.length === 0 && filterCategory === 'ALL') return null;
          if (filterCategory !== 'ALL' && filterCategory !== category) return null;

          const categoryCompleted = categoryTasks.filter((t) => t.status === 'DONE' || t.status === 'COMPLETED').length;
          const categoryProgress = Math.round((categoryCompleted / categoryTasks.length) * 100);
          const isExpanded = expandedCategories.has(category);

          return (
            <div key={category} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-orange-50 to-white hover:from-orange-100"
              >
                <div className="flex items-center gap-4">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-orange-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-orange-600" />
                  )}
                  <div className="text-left">
                    <h3 className="font-bold text-lg text-gray-900">{category}</h3>
                    <p className="text-sm text-gray-500">
                      {categoryTasks.length}개 타스크 • {categoryCompleted}개 완료
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 bg-gray-200 rounded-full h-2 hidden md:block">
                    <div 
                      className="bg-orange-400 h-2 rounded-full"
                      style={{ width: `${categoryProgress}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold text-orange-600">{categoryProgress}%</span>
                </div>
              </button>

              {/* Tasks */}
              {isExpanded && (
                <div className="divide-y divide-gray-100">
                  {filteredCategoryTasks.map((task) => {
                    const statusInfo = getTaskStatusInfo(task);
                    const StatusIcon = statusInfo.icon;

                    return (
                      <div 
                        key={task.id}
                        className={`px-6 py-4 hover:bg-gray-50 ${statusInfo.isOverdue ? 'border-l-4 border-l-red-500' : ''}`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Status Icon */}
                          <div className={`p-2 rounded-full ${statusInfo.bgColor}`}>
                            <StatusIcon className={`w-4 h-4 ${statusInfo.textColor}`} />
                          </div>

                          {/* Task Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900 truncate">{task.title}</h4>
                              {task.isMilestone && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                                  마일스톤
                                </span>
                              )}
                            </div>
                            {task.subcategory && (
                              <p className="text-sm text-gray-500 mb-2">{task.subcategory}</p>
                            )}
                            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                              {task.startDate && (
                                <span className="flex items-center gap-1" title="시작 예정일">
                                  <Calendar className="w-3 h-3" />
                                  시작: {format(new Date(task.startDate), 'M/d')}
                                </span>
                              )}
                              {task.dueDate && (
                                <span className={`flex items-center gap-1 ${statusInfo.isOverdue ? 'text-red-600 font-medium' : ''}`} title="목표 완료일">
                                  <Clock className="w-3 h-3" />
                                  목표: {format(new Date(task.dueDate), 'M/d')}
                                  {statusInfo.isOverdue && ' (지연)'}
                                </span>
                              )}
                              <span className="flex items-center gap-1" title="예상 소요 기간 (영업일)">
                                소요: {task.durationDays || 1}일
                              </span>
                              {task.daysBeforeOpening !== null && task.daysBeforeOpening !== undefined && (
                                <span className="flex items-center gap-1 text-orange-600" title="오픈일 기준 D-day">
                                  D-{task.daysBeforeOpening}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {/* Status Dropdown */}
                            <select
                              value={task.status}
                              onChange={(e) => handleStatusChange(task, e.target.value)}
                              className={`text-sm border rounded-lg px-2 py-1 ${statusInfo.bgColor} ${statusInfo.textColor}`}
                            >
                              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                <option key={key} value={key}>{config.label}</option>
                              ))}
                            </select>

                            {/* Assignee Dropdown */}
                            <select
                              value={task.assignee?.id || ''}
                              onChange={(e) => handleAssigneeChange(task, e.target.value || null)}
                              className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                            >
                              <option value="">담당자 없음</option>
                              {users.map((user) => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                              ))}
                            </select>

                            {/* Comments Button */}
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                setShowCommentsModal(true);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                            >
                              <MessageSquare className="w-4 h-4" />
                              {task._count.comments > 0 && (
                                <span>{task._count.comments}</span>
                              )}
                            </button>

                            {/* Reschedule Button */}
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                setShowRescheduleModal(true);
                              }}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                              title="일정 변경"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">일정 변경</h3>
            <p className="text-gray-600 mb-4">{selectedTask.title}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이동할 일수 (영업일 기준)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRescheduleData(prev => ({ ...prev, deltaDays: prev.deltaDays - 1 }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={rescheduleData.deltaDays}
                    onChange={(e) => setRescheduleData(prev => ({ ...prev, deltaDays: parseInt(e.target.value) || 0 }))}
                    className="w-20 text-center border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <button
                    onClick={() => setRescheduleData(prev => ({ ...prev, deltaDays: prev.deltaDays + 1 }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    +
                  </button>
                  <span className="text-sm text-gray-500">
                    {rescheduleData.deltaDays > 0 ? '일 뒤로' : rescheduleData.deltaDays < 0 ? '일 앞으로' : ''}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  적용 범위
                </label>
                <div className="space-y-2">
                  {RESCHEDULE_MODES.map((mode) => (
                    <label key={mode.value} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="rescheduleMode"
                        value={mode.value}
                        checked={rescheduleData.mode === mode.value}
                        onChange={(e) => setRescheduleData(prev => ({ ...prev, mode: e.target.value }))}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{mode.label}</div>
                        <div className="text-sm text-gray-500">{mode.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={rescheduleData.deltaDays === 0}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                적용
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Modal */}
      {showCommentsModal && selectedTask && (
        <TaskCommentsModal
          taskId={selectedTask.id}
          taskTitle={selectedTask.title}
          currentUserId={(session?.user as { id?: string })?.id}
          onClose={() => {
            setShowCommentsModal(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
