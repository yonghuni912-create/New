import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Store, ListTodo, CheckCircle, Clock } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';

async function getDashboardData() {
  const [
    totalStores,
    storesInProgress,
    totalTasks,
    completedTasks,
    recentStores,
  ] = await Promise.all([
    prisma.store.count(),
    prisma.store.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.task.count(),
    prisma.task.count({ where: { status: 'DONE' } }),
    prisma.store.findMany({
      include: {
        country: true,
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return {
    totalStores,
    storesInProgress,
    totalTasks,
    completedTasks,
    recentStores,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  const kpis = [
    {
      title: 'Total Stores',
      value: data.totalStores,
      icon: Store,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      title: 'In Progress',
      value: data.storesInProgress,
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
    },
    {
      title: 'Total Tasks',
      value: data.totalTasks,
      icon: ListTodo,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      title: 'Completed Tasks',
      value: data.completedTasks,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Link href="/dashboard/stores/new">
          <Button variant="primary">New Store</Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{kpi.title}</p>
                  <p className="text-3xl font-bold mt-2">{kpi.value}</p>
                </div>
                <div className={`p-3 rounded-full ${kpi.bg}`}>
                  <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Stores */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Stores</CardTitle>
            <Link href="/dashboard/stores">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.recentStores.map((store) => (
              <Link
                key={store.id}
                href={`/dashboard/stores/${store.id}`}
                className="block p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{store.storeName}</h3>
                    <p className="text-sm text-gray-600">
                      {store.storeCode} • {store.country.name}
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span>📅 {formatDate(store.plannedOpenDate)}</span>
                      <span>📋 {store._count.tasks} tasks</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <Badge
                      variant={
                        store.status === 'OPEN'
                          ? 'success'
                          : store.status === 'IN_PROGRESS'
                          ? 'warning'
                          : 'default'
                      }
                    >
                      {store.status}
                    </Badge>
                    {store.estimatedRevenue && (
                      <span className="text-sm text-gray-500">
                        {formatCurrency(store.estimatedRevenue)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
