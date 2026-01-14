import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowLeft, Calendar, FileText } from 'lucide-react';
import StoreDetailTabs from '@/components/StoreDetailTabs';

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const [store, countries] = await Promise.all([
    prisma.store.findUnique({
      where: { id },
      include: {
        plannedOpenDates: {
          orderBy: { createdAt: 'desc' },
        },
        milestones: {
          orderBy: { date: 'asc' },
        },
        files: {
          orderBy: { createdAt: 'desc' },
        },
        tasks: {
          orderBy: { dueDate: 'asc' },
          take: 10,
        },
      },
    }),
    prisma.country.findMany({
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!store) {
    notFound();
  }

  const storeName = store.officialName || store.tempName || 'Unnamed Store';
  const user = session.user as { id: string; role: string };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/stores"
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{storeName}</h1>
            <p className="text-gray-600 mt-1">
              {store.city}, {store.country}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href={`/dashboard/stores/${store.id}/timeline`}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Timeline
          </Link>
          <Link
            href={`/dashboard/stores/${store.id}/files`}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-4 h-4 mr-2" />
            Files
          </Link>
        </div>
      </div>

      <StoreDetailTabs
        store={store}
        countries={countries}
        userId={user.id}
        userRole={user.role}
      />
    </div>
  );
}
