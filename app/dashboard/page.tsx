import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DashboardCharts from '@/components/DashboardCharts';

// Status colors for the pie chart
const STATUS_COLORS: Record<string, string> = {
  PLANNING: '#FFB088',
  CONFIRMED: '#4ECDC4',
  IN_PROGRESS: '#FF6B35',
  OPENED: '#45B7D1',
  ON_HOLD: '#FFEAA7',
  CANCELLED: '#FF6B6B',
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  try {
    const [storeCount, userCount, activeTaskCount, storesByCountry, storesByStatus] = await Promise.all([
      prisma.store.count(),
      prisma.user.count(),
      prisma.task.count({
        where: {
          status: {
            in: ['NOT_STARTED', 'IN_PROGRESS'],
          },
        },
      }),
      prisma.store.groupBy({
        by: ['country'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.store.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const recentStores = await prisma.store.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        plannedOpenDates: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {session?.user?.name}!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's what's happening with your store launches
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Team Members</p>
              <p className="text-2xl font-bold text-gray-900">{userCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Stores
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recentStores.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No stores yet. Create your first store to get started!
            </div>
          ) : (
            recentStores.map((store) => (
              <div key={store.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      {store.officialName || store.tempName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {store.city}, {store.country}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      {store.status}
                    </span>
                    {store.plannedOpenDates[0] && (
                      <p className="text-xs text-gray-500 mt-1">
                        Opens:{' '}
                        {new Date(
                          store.plannedOpenDates[0].date
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Charts Section */}
      <DashboardCharts
        storesByCountry={storesByCountry.map((item) => ({
          country: item.country,
          count: item._count.id,
          color: '',
        }))}
        storesByStatus={storesByStatus.map((item) => ({
          status: item.status,
          count: item._count.id,
          color: STATUS_COLORS[item.status] || '#ccc',
        }))}
      />
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
