import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatCurrency, daysUntil } from '@/lib/utils';
import { notFound } from 'next/navigation';

async function getStore(id: string) {
  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      country: true,
      plannedOpenDates: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      milestones: {
        orderBy: { targetDate: 'asc' },
      },
      files: {
        orderBy: { createdAt: 'desc' },
      },
      tasks: {
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      },
    },
  });

  return store;
}

const statusVariant: Record<string, any> = {
  PLANNING: 'default',
  IN_PROGRESS: 'warning',
  READY: 'primary',
  OPEN: 'success',
  DELAYED: 'danger',
  CANCELLED: 'secondary',
};

const taskStatusVariant: Record<string, any> = {
  TODO: 'default',
  IN_PROGRESS: 'warning',
  BLOCKED: 'danger',
  DONE: 'success',
  CANCELLED: 'secondary',
};

const priorityVariant: Record<string, any> = {
  LOW: 'default',
  MEDIUM: 'primary',
  HIGH: 'warning',
  URGENT: 'danger',
};

export default async function StoreDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const store = await getStore(params.id);

  if (!store) {
    notFound();
  }

  const tasksByPhase = store.tasks.reduce((acc, task) => {
    const phase = task.phase || 'Unassigned';
    if (!acc[phase]) {
      acc[phase] = [];
    }
    acc[phase].push(task);
    return acc;
  }, {} as Record<string, typeof store.tasks>);

  const completedTasks = store.tasks.filter((t) => t.status === 'DONE').length;
  const totalTasks = store.tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{store.storeName}</h1>
          <p className="text-gray-600 mt-1">
            {store.storeCode} • {store.country.name}
          </p>
        </div>
        <Badge variant={statusVariant[store.status] || 'default'} className="text-lg px-4 py-2">
          {store.status}
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Planned Open Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatDate(store.plannedOpenDate)}</p>
            {store.plannedOpenDate && (
              <p className="text-sm text-gray-500 mt-1">
                {daysUntil(store.plannedOpenDate)} days remaining
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Task Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{progress}%</p>
            <p className="text-sm text-gray-500 mt-1">
              {completedTasks} of {totalTasks} tasks completed
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Estimated Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(store.estimatedRevenue)}
            </p>
            {store.initialInvestment && (
              <p className="text-sm text-gray-500 mt-1">
                Investment: {formatCurrency(store.initialInvestment)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Store Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Store Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {store.address && (
              <div>
                <span className="font-medium text-gray-700">Address:</span>
                <p className="text-gray-600">
                  {store.address}
                  {store.city && `, ${store.city}`}
                  {store.state && `, ${store.state}`}
                  {store.postalCode && ` ${store.postalCode}`}
                </p>
              </div>
            )}
            {store.franchiseeName && (
              <div>
                <span className="font-medium text-gray-700">Franchisee:</span>
                <p className="text-gray-600">{store.franchiseeName}</p>
              </div>
            )}
            {store.franchiseeEmail && (
              <div>
                <span className="font-medium text-gray-700">Email:</span>
                <p className="text-gray-600">{store.franchiseeEmail}</p>
              </div>
            )}
            {store.franchiseePhone && (
              <div>
                <span className="font-medium text-gray-700">Phone:</span>
                <p className="text-gray-600">{store.franchiseePhone}</p>
              </div>
            )}
            {store.notes && (
              <div>
                <span className="font-medium text-gray-700">Notes:</span>
                <p className="text-gray-600">{store.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Files ({store.files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {store.files.length > 0 ? (
              <div className="space-y-2">
                {store.files.slice(0, 5).map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{file.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(file.createdAt)} • {file.uploadedBy}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No files uploaded yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tasks by Phase */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Tasks</h2>
        {Object.entries(tasksByPhase).map(([phase, tasks]) => (
          <Card key={phase}>
            <CardHeader>
              <CardTitle>{phase}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        {task.dueDate && <span>📅 Due: {formatDate(task.dueDate)}</span>}
                        {task.assignee && <span>👤 {task.assignee.name}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <Badge variant={taskStatusVariant[task.status] || 'default'}>
                        {task.status}
                      </Badge>
                      <Badge variant={priorityVariant[task.priority] || 'default'}>
                        {task.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
