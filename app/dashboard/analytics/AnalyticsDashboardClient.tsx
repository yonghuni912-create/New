'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
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
  Filter,
  MapPin,
  Building2,
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

interface FilterOption {
  id: string;
  name: string;
}

interface MetabaseConfig {
  configured: boolean;
  defaultDashboardId: string | null;
  availableFilters: {
    stores: FilterOption[];
    regions: FilterOption[];
    dateRanges: FilterOption[];
  };
}

export default function AnalyticsDashboardClient({ metabaseUrl, dashboardId }: Props) {
  const [activeTab, setActiveTab] = useState<'kpi' | 'metabase'>('kpi');
  const [kpi, setKpi] = useState<SalesKPI | null>(null);
  const [salesData, setSalesData] = useState<DailySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  
  // Metabase Interactive Embedding 상태
  const [metabaseConfig, setMetabaseConfig] = useState<MetabaseConfig | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [embedLoading, setEmbedLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('last7days');
  const [customStartDate, setCustomStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

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

  // Metabase 설정 정보 로드
  const fetchMetabaseConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/metabase/embed');
      if (res.ok) {
        const data = await res.json();
        setMetabaseConfig(data);
      }
    } catch (err) {
      console.error('Failed to fetch Metabase config:', err);
    }
  }, []);

  // Interactive Embed URL 생성
  const fetchEmbedUrl = useCallback(async () => {
    if (!metabaseConfig?.configured) return;
    
    setEmbedLoading(true);
    try {
      // 날짜 범위 계산
      let startDate = customStartDate;
      let endDate = customEndDate;
      const today = new Date();
      
      switch (selectedDateRange) {
        case 'today':
          startDate = endDate = format(today, 'yyyy-MM-dd');
          break;
        case 'yesterday':
          startDate = endDate = format(subDays(today, 1), 'yyyy-MM-dd');
          break;
        case 'last7days':
          startDate = format(subDays(today, 7), 'yyyy-MM-dd');
          endDate = format(today, 'yyyy-MM-dd');
          break;
        case 'last30days':
          startDate = format(subDays(today, 30), 'yyyy-MM-dd');
          endDate = format(today, 'yyyy-MM-dd');
          break;
        case 'thisMonth':
          startDate = format(startOfMonth(today), 'yyyy-MM-dd');
          endDate = format(today, 'yyyy-MM-dd');
          break;
        case 'lastMonth':
          const lastMonth = subMonths(today, 1);
          startDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
          endDate = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
          break;
      }

      // 필터 파라미터 구성
      const params: Record<string, any> = {};
      if (selectedStore !== 'all') {
        params.store_name = selectedStore;
      }
      if (selectedRegion !== 'all') {
        params.region = selectedRegion;
      }
      params.start_date = startDate;
      params.end_date = endDate;

      const res = await fetch('/api/metabase/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType: 'dashboard',
          resourceId: parseInt(dashboardId || metabaseConfig.defaultDashboardId || '1'),
          params,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setEmbedUrl(data.iframeUrl);
      } else {
        const error = await res.json();
        console.error('Embed URL error:', error);
      }
    } catch (err) {
      console.error('Failed to fetch embed URL:', err);
    } finally {
      setEmbedLoading(false);
    }
  }, [metabaseConfig, dashboardId, selectedStore, selectedRegion, selectedDateRange, customStartDate, customEndDate]);

  useEffect(() => {
    fetchMetabaseConfig();
  }, [fetchMetabaseConfig]);

  useEffect(() => {
    if (activeTab === 'kpi') {
      fetchKPIData();
    } else if (activeTab === 'metabase' && metabaseConfig?.configured) {
      fetchEmbedUrl();
    }
  }, [activeTab, fetchKPIData, fetchEmbedUrl, metabaseConfig]);

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
        <div className="space-y-4">
          {/* 필터 섹션 */}
          {metabaseConfig?.configured && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold text-gray-700">Dashboard Filters</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 지역 필터 */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Region
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {metabaseConfig.availableFilters.regions.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* 매장 필터 */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    <Building2 className="inline h-4 w-4 mr-1" />
                    Store
                  </label>
                  <select
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {metabaseConfig.availableFilters.stores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* 날짜 범위 필터 */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Date Range
                  </label>
                  <select
                    value={selectedDateRange}
                    onChange={(e) => setSelectedDateRange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {metabaseConfig.availableFilters.dateRanges.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* 적용 버튼 */}
                <div className="flex items-end">
                  <button
                    onClick={fetchEmbedUrl}
                    disabled={embedLoading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                  >
                    {embedLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Apply Filters
                  </button>
                </div>
              </div>

              {/* 커스텀 날짜 범위 */}
              {selectedDateRange === 'custom' && (
                <div className="mt-4 flex items-center gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metabase 대시보드 임베드 */}
          <div className="bg-white rounded-lg shadow">
            {embedLoading ? (
              <div className="flex items-center justify-center h-[700px]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600">Loading dashboard...</span>
              </div>
            ) : embedUrl ? (
              <iframe
                src={embedUrl}
                className="w-full h-[800px] border-0 rounded-lg"
                title="Metabase Dashboard"
              />
            ) : metabaseConfig?.configured ? (
              <div className="p-12 text-center">
                <BarChart3 className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-800">Interactive Dashboard Ready</h3>
                <p className="text-gray-600 mt-2 max-w-md mx-auto">
                  Select your filters above and click "Apply Filters" to load the dashboard with your preferences.
                </p>
                <button
                  onClick={fetchEmbedUrl}
                  className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Load Dashboard
                </button>
              </div>
            ) : (
              <div className="p-12 text-center">
                <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-800">Metabase Not Configured</h3>
                <p className="text-gray-600 mt-2 max-w-md mx-auto">
                  To enable Interactive Embedding, please set the following environment variables:
                </p>
                <div className="mt-4 bg-gray-100 rounded-lg p-4 inline-block text-left">
                  <code className="text-sm">
                    METABASE_URL=https://your-metabase.com<br/>
                    METABASE_SECRET_KEY=your-embedding-secret-key<br/>
                    METABASE_DASHBOARD_ID=your-dashboard-id
                  </code>
                </div>
                <p className="text-gray-500 text-sm mt-4">
                  You can find the secret key in Metabase Admin → Settings → Embedding.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
