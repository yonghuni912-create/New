import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import FileManager from '@/components/FileManager';

export default async function StoreFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;
  const user = session.user as { id: string; role: string };

  const store = await prisma.store.findUnique({
    where: { id },
    select: {
      id: true,
      officialName: true,
      tempName: true,
      city: true,
      country: true,
    },
  });

  if (!store) {
    notFound();
  }

  const files = await prisma.storeFile.findMany({
    where: { storeId: id },
    orderBy: { createdAt: 'desc' },
  });

  const storeName = store.officialName || store.tempName || 'Unnamed Store';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href={`/dashboard/stores/${id}`}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Files - {storeName}
            </h1>
            <p className="text-gray-600 mt-1">
              {store.city}, {store.country}
            </p>
          </div>
        </div>
      </div>

      <FileManager storeId={id} initialFiles={files} userId={user.id} />
    </div>
  );
}
