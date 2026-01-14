import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import StoreForm from '@/components/StoreForm';

export default async function NewStorePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as { id: string; role: string };

  // Only ADMIN and PM can create stores
  if (!['ADMIN', 'PM'].includes(user.role)) {
    redirect('/dashboard/stores');
  }

  const countries = await prisma.country.findMany({
    orderBy: { name: 'asc' },
  });

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Store</h1>
        <p className="text-gray-600 mt-2">
          Add a new store to the launch pipeline
        </p>
      </div>

      <StoreForm countries={countries} userId={user.id} />
    </div>
  );
}
