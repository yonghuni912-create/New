'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import {
  BarChart3,
  Calendar,
  Store,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface Props {
  metabaseUrl?: string;
  dashboardId?: string;
}

interface SalesKPI {
  today_sales: number;
  yesterday_sales: number;
  dod_pct: number;
  last_week_sales: number;
  wow_pct: number;
  mtd_sales: number;
  ytd_sales: number;
}

interface DailySales {
  business_date: string;
  restaurant_name: string;
  total_sales: number;
  order_count: number;
  avg_ticket: number;
}

export default function AnalyticsDashboardClient({ metabaseUrl, dashboardId }: Props) {
  const [activeTab, setActiveTab] = useState<'kpi' | 'metabase'>('kpi');
  const [kpi, setKpi] = useState<SalesKPI | null>(null);
  const [salesData, setSalesData] = useState<DailySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));

  const fetchKPIData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/analytics?type=kpi&date=${targetDate}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch KPI data');
      }
      
      setKpi(data.kpi);
      setSalesData(data.salesData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => {
    if (activeTab === 'kpi') {
      fetchKPIData();
    }
  }, [activeTab, fetchKPIData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const getChangeColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const getChangeBg = (value: number) => {
    if (value > 0) return 'bg-green-100';
    if (value < 0) return 'bg-red-100';
    return 'bg-gray-100';
  };

  // Metabase 임베드 URL 생성
  const getMetabaseEmbedUrl = () => {
    if (!metabaseUrl || !dashboardId) return null;
    // Public embed URL (Metabase에서 public sharing 활성화 필요)
    return `${metabaseUrl}/public/dashboard/${dashboardId}`;
  };

  return (
    <div className="space-y-6">
      {/* 탭 선택 */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('kpi')}
          className={`pb-3 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'kpi'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart3 className="inline-block h-4 w-4 mr-2" />
          KPI Dashboard
        </button>
        <button
          onClick={() => setActiveTab('metabase')}
          className={`pb-3 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'metabase'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ExternalLink className="inline-block h-4 w-4 mr-2" />
          Metabase Dashboard
        </button>
      </div>

      {activeTab === 'kpi' && (
        <>
          {/* 날짜 선택 및 새로고침 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </label>
            </div>
            <button
              onClick={fetchKPIData}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loading && !kpi ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading KPI data...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-800">Failed to Load Data</h3>
              <p className="text-red-600 mt-2">{error}</p>
              <button
                onClick={fetchKPIData}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          ) : kpi ? (
            <>
              {/* KPI 카드 그리드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Today Sales */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Today Sales</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {formatCurrency(kpi.today_sales)}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <DollarSign className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-medium ${getChangeBg(kpi.dod_pct)} ${getChangeColor(kpi.dod_pct)}`}>
                      {kpi.dod_pct > 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                      {formatPercent(kpi.dod_pct)}
                    </span>
                    <span className="text-gray-500 text-sm ml-2">vs yesterday</span>
                  </div>
                </div>

                {/* WoW Change */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Last Week Same Day</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {formatCurrency(kpi.last_week_sales)}
                      </p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-full">
                      <TrendingUp className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-medium ${getChangeBg(kpi.wow_pct)} ${getChangeColor(kpi.wow_pct)}`}>
                      {kpi.wow_pct > 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                      {formatPercent(kpi.wow_pct)}
                    </span>
                    <span className="text-gray-500 text-sm ml-2">WoW change</span>
                  </div>
                </div>

                {/* MTD */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Month to Date</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {formatCurrency(kpi.mtd_sales)}
                      </p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <Calendar className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </div>

                {/* YTD */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Year to Date</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {formatCurrency(kpi.ytd_sales)}
                      </p>
                    </div>
                    <div className="p-3 bg-orange-100 rounded-full">
                      <BarChart3 className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 매장별 매출 테이블 */}
              {salesData.length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Store Performance</h3>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Store
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Sales
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Orders
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Ticket
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {salesData.map((store, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Store className="h-5 w-5 text-gray-400 mr-2" />
                              <span className="font-medium text-gray-900">{store.restaurant_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                            {formatCurrency(store.total_sales)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                            {store.order_count.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                            {formatCurrency(store.avg_ticket)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </>
      )}

      {activeTab === 'metabase' && (
        <div className="bg-white rounded-lg shadow">
          {getMetabaseEmbedUrl() ? (
            <iframe
              src={getMetabaseEmbedUrl()!}
              className="w-full h-[800px] border-0 rounded-lg"
              title="Metabase Dashboard"
            />
          ) : (
            <div className="p-12 text-center">
              <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800">Metabase Not Configured</h3>
              <p className="text-gray-600 mt-2 max-w-md mx-auto">
                To enable Metabase embedding, please set the following environment variables:
              </p>
              <div className="mt-4 bg-gray-100 rounded-lg p-4 inline-block text-left">
                <code className="text-sm">
                  METABASE_URL=https://your-metabase.com<br/>
                  METABASE_DASHBOARD_ID=your-dashboard-id
                </code>
              </div>
              <p className="text-gray-500 text-sm mt-4">
                Also ensure public sharing is enabled for the dashboard in Metabase settings.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
