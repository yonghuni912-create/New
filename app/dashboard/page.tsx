import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

// Status colors for the pie chart
const STATUS_COLORS: Record<string, string> = {
  PLANNING: '#FFB088',
  CONFIRMED: '#4ECDC4',
  IN_PROGRESS: '#FF6B35',
  OPENED: '#45B7D1',
  ON_HOLD: '#FFEAA7',
  CANCELLED: '#FF6B6B',
};

// Action icons and labels
const ACTION_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  CREATE: { label: '생성', emoji: '✨', color: 'text-green-600' },
  UPDATE: { label: '수정', emoji: '✏️', color: 'text-blue-600' },
  DELETE: { label: '삭제', emoji: '🗑️', color: 'text-red-600' },
  TASK_CREATE: { label: '태스크 추가', emoji: '📋', color: 'text-purple-600' },
  TASK_UPDATE: { label: '일정 변경', emoji: '📅', color: 'text-orange-600' },
  TASK_STATUS: { label: '상태 변경', emoji: '🔄', color: 'text-indigo-600' },
  COMMENT: { label: '댓글', emoji: '💬', color: 'text-teal-600' },
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  try {
    // Get basic counts and recent activity
    const [storeCount, userCount, activeTaskCount, completedTaskCount, overdueTasks, recentComments, recentTasks, upcomingTasks] = await Promise.all([
      prisma.store.count(),
      prisma.user.count(),
      prisma.task.count({
        where: {
          status: {
            in: ['NOT_STARTED', 'IN_PROGRESS'],
          },
        },
      }),
      // Completed tasks count (last 30 days)
      prisma.task.count({
        where: {
          status: { in: ['DONE', 'COMPLETED'] },
          updatedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // Overdue tasks
      prisma.task.findMany({
        take: 5,
        orderBy: { dueDate: 'asc' },
        where: {
          status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
          dueDate: { lt: new Date() },
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          store: { select: { storeName: true, id: true } },
        },
      }),
      // Recent comments
      prisma.taskComment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          task: { 
            select: { 
              title: true, 
              store: { select: { storeName: true, id: true } } 
            } 
          },
        },
      }),
      // Recently updated tasks (schedule changes)
      prisma.task.findMany({
        take: 8,
        orderBy: { updatedAt: 'desc' },
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          store: { select: { storeName: true, id: true } },
        },
      }),
      // Upcoming tasks (due within 7 days)
      prisma.task.findMany({
        take: 5,
        orderBy: { dueDate: 'asc' },
        where: {
          status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          store: { select: { storeName: true, id: true } },
        },
      }),
    ]);

    const recentStores = await prisma.store.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {session?.user?.name}님!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's what's happening with your store launches
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Stores</p>
              <p className="text-2xl font-bold text-gray-900">{storeCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Tasks</p>
              <p className="text-2xl font-bold text-gray-900">
                {activeTaskCount}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${overdueTasks.length > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                <svg
                  className={`w-6 h-6 ${overdueTasks.length > 0 ? 'text-red-600' : 'text-green-600'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {overdueTasks.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">완료 (30일)</p>
              <p className="text-2xl font-bold text-green-600">{completedTaskCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Activity Feed */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                📋 최근 활동
              </h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {recentTasks.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  최근 활동이 없습니다.
                </div>
              ) : (
                recentTasks.map((task) => (
                  <Link 
                    key={task.id} 
                    href={`/dashboard/stores/${task.store?.id}`}
                    className="block px-6 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">📅</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {task.store?.storeName || '알 수 없는 매장'} • 
                          <span className={`ml-1 ${
                            task.status === 'DONE' || task.status === 'COMPLETED' 
                              ? 'text-green-600' 
                              : task.status === 'IN_PROGRESS' 
                                ? 'text-blue-600' 
                                : 'text-gray-600'
                          }`}>
                            {task.status === 'DONE' || task.status === 'COMPLETED' ? '완료' : 
                             task.status === 'IN_PROGRESS' ? '진행중' : '대기'}
                          </span>
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true, locale: ko })}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Recent Comments */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                💬 최근 댓글
              </h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
              {recentComments.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  아직 댓글이 없습니다. 태스크에서 팀원들과 소통해보세요!
                </div>
              ) : (
                recentComments.map((comment) => (
                  <Link 
                    key={comment.id} 
                    href={`/dashboard/stores/${comment.task?.store?.id}`}
                    className="block px-6 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-sm">
                        {comment.user?.name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {comment.user?.name || '익명'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ko })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{comment.content}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {comment.task?.title} • {comment.task?.store?.storeName}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Stores & Upcoming */}
        <div className="space-y-6">
          {/* Overdue Tasks - Only show if there are overdue items */}
          {overdueTasks.length > 0 && (
            <div className="bg-red-50 rounded-lg shadow border border-red-200">
              <div className="px-6 py-4 border-b border-red-200 bg-red-100 rounded-t-lg">
                <h2 className="text-lg font-semibold text-red-800 flex items-center gap-2">
                  🚨 지연된 태스크 ({overdueTasks.length})
                </h2>
              </div>
              <div className="divide-y divide-red-100">
                {overdueTasks.map((task) => {
                  const daysOverdue = task.dueDate 
                    ? Math.floor((Date.now() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  return (
                    <Link 
                      key={task.id} 
                      href={`/dashboard/stores/${task.store?.id}`}
                      className="block px-6 py-3 hover:bg-red-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-red-900 truncate">{task.title}</p>
                          <p className="text-xs text-red-700">{task.store?.storeName}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-600 text-white">
                            {daysOverdue}일 지연
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Tasks */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                ⏰ 다가오는 마감 (7일 이내)
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {upcomingTasks.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  7일 내 마감 예정인 태스크가 없습니다
                </div>
              ) : (
                upcomingTasks.map((task) => {
                  const daysRemaining = task.dueDate 
                    ? Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : 99;
                  const urgencyClass = daysRemaining <= 1 
                    ? 'bg-red-100 text-red-700 border-red-200' 
                    : daysRemaining <= 3 
                      ? 'bg-orange-100 text-orange-700 border-orange-200' 
                      : 'bg-yellow-100 text-yellow-700 border-yellow-200';
                  return (
                    <Link 
                      key={task.id} 
                      href={`/dashboard/stores/${task.store?.id}`}
                      className="block px-6 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                          <p className="text-xs text-gray-500">{task.store?.storeName}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${urgencyClass}`}>
                            {daysRemaining === 0 ? '오늘' : daysRemaining === 1 ? '내일' : `${daysRemaining}일 남음`}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Stores */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                🏪 최근 매장
              </h2>
              <Link href="/dashboard/stores" className="text-sm text-orange-600 hover:text-orange-700">
                전체 보기 →
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {recentStores.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  아직 매장이 없습니다. 첫 번째 매장을 등록해보세요!
                </div>
              ) : (
                recentStores.map((store) => (
                  <Link 
                    key={store.id} 
                    href={`/dashboard/stores/${store.id}`}
                    className="block px-6 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {store.storeName || store.storeCode}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {store.city || ''}{store.city && store.country ? ', ' : ''}{store.country || ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          store.status === 'IN_PROGRESS' ? 'bg-orange-100 text-orange-800' :
                          store.status === 'OPENED' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {store.status === 'IN_PROGRESS' ? '진행중' : 
                           store.status === 'OPENED' ? '오픈완료' : 
                           store.status === 'PLANNING' ? '계획중' : store.status}
                        </span>
                        {store.plannedOpenDate && (
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(store.plannedOpenDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 오픈예정
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  } catch (error) {
    console.error('Dashboard error:', error);
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600">Dashboard Error</h1>
        <p className="mt-4 text-gray-600">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
        <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto">
          {JSON.stringify(error, null, 2)}
        </pre>
      </div>
    );
  }
}
