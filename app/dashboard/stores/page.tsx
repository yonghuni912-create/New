import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Plus } from 'lucide-react';

async function getStores() {
  const stores = await prisma.store.findMany({
    include: {
      country: true,
      _count: {
        select: {
          tasks: true,
          files: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return stores;
}

const statusVariant: Record<string, any> = {
  PLANNING: 'default',
  IN_PROGRESS: 'warning',
  READY: 'primary',
  OPEN: 'success',
  DELAYED: 'danger',
  CANCELLED: 'secondary',
};

export default async function StoresPage() {
  const stores = await getStores();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Stores</h1>
        <Link href="/dashboard/stores/new">
          <Button variant="primary">
            <Plus className="h-4 w-4 mr-2" />
            New Store
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stores.map((store) => (
          <Link key={store.id} href={`/dashboard/stores/${store.id}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{store.storeName}</h3>
                    <p className="text-sm text-gray-600">{store.storeCode}</p>
                  </div>
                  <Badge variant={statusVariant[store.status] || 'default'}>
                    {store.status}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium w-24">Country:</span>
                    <span>{store.country.name}</span>
                  </div>
                  {store.city && (
                    <div className="flex items-center text-gray-600">
                      <span className="font-medium w-24">City:</span>
                      <span>{store.city}</span>
                    </div>
                  )}
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium w-24">Open Date:</span>
                    <span>{formatDate(store.plannedOpenDate)}</span>
                  </div>
                  {store.estimatedRevenue && (
                    <div className="flex items-center text-gray-600">
                      <span className="font-medium w-24">Revenue:</span>
                      <span>{formatCurrency(store.estimatedRevenue)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
                  <span>📋 {store._count.tasks} tasks</span>
                  <span>📎 {store._count.files} files</span>
                </div>

                {store.franchiseeName && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Franchisee:</span> {store.franchiseeName}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {stores.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 mb-4">No stores yet</p>
            <Link href="/dashboard/stores/new">
              <Button variant="primary">Create Your First Store</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
