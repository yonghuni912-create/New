import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AnalyticsDashboardClient from './AnalyticsDashboardClient';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  // Metabase 설정 확인
  const metabaseUrl = process.env.METABASE_URL;
  const metabaseDashboardId = process.env.METABASE_DASHBOARD_ID;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sales Analytics</h1>
        <p className="text-gray-600 mt-1">
          Interactive dashboards powered by Metabase
        </p>
      </div>
      
      <AnalyticsDashboardClient 
        metabaseUrl={metabaseUrl}
        dashboardId={metabaseDashboardId}
      />
    </div>
  );
}
