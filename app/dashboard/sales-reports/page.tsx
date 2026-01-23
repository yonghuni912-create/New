import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SalesReportsClient from './SalesReportsClient';

export const dynamic = 'force-dynamic';

export default async function SalesReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
        <p className="text-gray-600 mt-1">
          Daily email reports from BBQ Command Center
        </p>
      </div>
      <SalesReportsClient />
    </div>
  );
}
