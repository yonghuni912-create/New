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
  Filter,
  Clock,
  Receipt,
  CreditCard,
  Utensils,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';

// Metabase Question IDs (from AUTO - WindSurf Toast collection)
const QUESTION_IDS = {
  dailyNetSales: 262,      // Daily Net Sales & Tickets (line chart)
  executiveKpi: 263,       // Executive KPI Snapshot (table)
  channelMix: 264,         // Channel Mix (Platform) (bar chart)
  serviceTime: 265,        // Service Time (Minutes) - Avg by Day (line chart)
  topMenuItems: 266,       // Top 20 Menu Items (table)
  paymentMix: 267,         // Payment Mix & Tips (bar chart)
};

// 차트 색상 팔레트
const COLORS = ['#CC0000', '#D4AF37', '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#f59e0b', '#06b6d4'];
const PLATFORM_COLORS: Record<string, string> = {
  'other': '#CC0000',     // BBQ Red (In-store/Website)
  'uber': '#000000',      // Uber Black
  'doordash': '#FF3008',  // DoorDash Red
  'skip': '#FF6B35',      // SkipTheDishes Orange
  'fantuan': '#00B894',   // Fantuan Green
  'kiosk': '#6B7280',     // Kiosk Gray
};

interface DailySalesData {
  business_date: string;
  net_sales: number;
  tickets: number;
}

interface ExecutiveKPI {
  net_sales: number;
  tickets: number;
  avg_check: number;
  discount_rate: number;
  refund_rate: number;
}

interface ChannelMixData {
  platform: string;
  net_sales: number;
  tickets: number;
}

interface ServiceTimeData {
  business_date: string;
  avg_service_minutes: number;
}

interface TopMenuItem {
  item_key: string;
  menu_name: string;
  qty: number;
  gross_item_sales: number;
}

interface PaymentMixData {
  payment_type: string;
  total_amount: number;
  total_tips: number;
}

export default function MetabaseDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Question 데이터 상태
  const [dailySalesData, setDailySalesData] = useState<DailySalesData[]>([]);
  const [executiveKpi, setExecutiveKpi] = useState<ExecutiveKPI | null>(null);
  const [channelMixData, setChannelMixData] = useState<ChannelMixData[]>([]);
  const [serviceTimeData, setServiceTimeData] = useState<ServiceTimeData[]>([]);
  const [topMenuItems, setTopMenuItems] = useState<TopMenuItem[]>([]);
  const [paymentMixData, setPaymentMixData] = useState<PaymentMixData[]>([]);
  
  // 필터 상태
  const [dateFilter, setDateFilter] = useState<string>('');
  const [storeFilter, setStoreFilter] = useState<string>('');

  // Metabase Question 데이터 로드
  const executeQuestion = async (questionId: number, params?: any) => {
    const response = await fetch('/api/metabase/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, params }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Question ${questionId} failed:`, response.status, errorText);
      throw new Error(`Question ${questionId} failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`Question ${questionId} returned ${result.data?.length || 0} rows`);
    return result.data;
  };

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 모든 Question 병렬 실행
      const [
        dailySales,
        kpi,
        channels,
        serviceTime,
        topItems,
        payments,
      ] = await Promise.all([
        executeQuestion(QUESTION_IDS.dailyNetSales),
        executeQuestion(QUESTION_IDS.executiveKpi),
        executeQuestion(QUESTION_IDS.channelMix),
        executeQuestion(QUESTION_IDS.serviceTime),
        executeQuestion(QUESTION_IDS.topMenuItems),
        executeQuestion(QUESTION_IDS.paymentMix),
      ]);

      setDailySalesData(dailySales || []);
      setExecutiveKpi(kpi?.[0] || null);
      setChannelMixData(channels || []);
      setServiceTimeData(serviceTime || []);
      setTopMenuItems(topItems || []);
      setPaymentMixData(payments || []);
    } catch (err) {
      console.error('Error loading Metabase data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  // 최근 30일 데이터 필터링
  const recentDailySales = dailySalesData.slice(-30);
  
  // 총 매출 계산
  const totalNetSales = channelMixData.reduce((sum, c) => sum + c.net_sales, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-10 w-10 animate-spin text-red-600" />
        <span className="ml-3 text-lg text-gray-600">Loading Metabase Dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-800">Failed to Load Dashboard</h3>
        <p className="text-red-600 mt-2">{error}</p>
        <p className="text-gray-500 text-sm mt-2">
          Make sure Metabase is running at localhost:3000 and API key is configured.
        </p>
        <button
          onClick={loadAllData}
          className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            🍗 BBQ Sales Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Data from Metabase - AUTO WindSurf Toast Collection
          </p>
        </div>
        <button
          onClick={loadAllData}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Executive KPI Cards */}
      {executiveKpi && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Net Sales (Total)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(executiveKpi.net_sales)}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Tickets</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {executiveKpi.tickets.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Receipt className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Avg Check</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(executiveKpi.avg_check)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <ShoppingCart className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Discount Rate</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {formatPercent(executiveKpi.discount_rate)}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <TrendingDown className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Refund Rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatPercent(executiveKpi.refund_rate)}
                </p>
              </div>
              <div className="p-3 bg-gray-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Net Sales & Tickets - Line Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-red-500" />
            Daily Net Sales & Tickets
          </h3>
          {recentDailySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={recentDailySales}>
                <defs>
                  <linearGradient id="colorNetSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#CC0000" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#CC0000" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="business_date" 
                  tick={{ fontSize: 10 }} 
                  tickFormatter={(v) => format(new Date(v), 'MM/dd')}
                />
                <YAxis 
                  yAxisId="left"
                  tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} 
                  tick={{ fontSize: 11 }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    const numValue = typeof value === 'number' ? value : 0;
                    return [
                      name === 'net_sales' ? formatCurrency(numValue) : numValue.toLocaleString(),
                      name === 'net_sales' ? 'Net Sales' : 'Tickets'
                    ];
                  }}
                  labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                />
                <Legend />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="net_sales" 
                  name="Net Sales"
                  stroke="#CC0000" 
                  fillOpacity={1} 
                  fill="url(#colorNetSales)" 
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="tickets" 
                  name="Tickets"
                  stroke="#2563eb" 
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-gray-400">
              <p>No sales data available</p>
            </div>
          )}
        </div>

        {/* Channel Mix (Platform) - Bar Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-blue-500" />
            Channel Mix (Platform)
          </h3>
          {channelMixData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={channelMixData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <YAxis 
                  type="category" 
                  dataKey="platform" 
                  tick={{ fontSize: 12 }} 
                  width={70}
                  tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    const numValue = typeof value === 'number' ? value : 0;
                    return [
                      name === 'net_sales' ? formatCurrency(numValue) : numValue.toLocaleString(),
                      name === 'net_sales' ? 'Net Sales' : 'Tickets'
                    ];
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="net_sales" 
                  name="Net Sales"
                  radius={[0, 4, 4, 0]}
                >
                  {channelMixData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={PLATFORM_COLORS[entry.platform] || COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-gray-400">
              <p>No channel data available</p>
            </div>
          )}
          {/* 채널별 비율 요약 */}
          {channelMixData.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              {channelMixData.map((channel) => (
                <div key={channel.platform} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                  <span className="capitalize font-medium">{channel.platform}</span>
                  <span className="text-gray-500">
                    {((channel.net_sales / totalNetSales) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Service Time Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-orange-500" />
            Service Time (Minutes) - Avg by Day
          </h3>
          {serviceTimeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={serviceTimeData.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="business_date" 
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => format(new Date(v), 'MM/dd')}
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => `${v}m`}
                />
                <Tooltip 
                  formatter={(value) => {
                    const numValue = typeof value === 'number' ? value : 0;
                    return [`${numValue.toFixed(1)} min`, 'Avg Service Time'];
                  }}
                  labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                />
                <Line 
                  type="monotone" 
                  dataKey="avg_service_minutes" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-400">
              <p>No service time data available</p>
            </div>
          )}
        </div>

        {/* Payment Mix */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <CreditCard className="h-5 w-5 mr-2 text-purple-500" />
            Payment Mix & Tips
          </h3>
          {paymentMixData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={paymentMixData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="payment_type" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value, name) => {
                    const numValue = typeof value === 'number' ? value : 0;
                    return [
                      formatCurrency(numValue),
                      name === 'total_amount' ? 'Amount' : 'Tips'
                    ];
                  }}
                />
                <Legend />
                <Bar dataKey="total_amount" name="Amount" fill="#9333ea" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total_tips" name="Tips" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-400">
              <p>No payment data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Top 20 Menu Items Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Utensils className="h-5 w-5 mr-2 text-green-500" />
          Top 20 Menu Items (Gross Item Sales)
        </h3>
        {topMenuItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Menu Item
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Gross Sales
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {topMenuItems.map((item, idx) => {
                  const totalGrossSales = topMenuItems.reduce((sum, i) => sum + i.gross_item_sales, 0);
                  const percentage = (item.gross_item_sales / totalGrossSales) * 100;
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          idx < 3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{item.menu_name}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {item.qty.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        {formatCurrency(item.gross_item_sales)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-red-500 h-2 rounded-full" 
                              style={{ width: `${Math.min(percentage * 3, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-12 text-right">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-400">
            <p>No menu data available</p>
          </div>
        )}
      </div>

      {/* Metabase Link */}
      <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center text-gray-600">
          <BarChart3 className="h-5 w-5 mr-2" />
          <span className="text-sm">
            Data source: <strong>AUTO - WindSurf Toast</strong> collection (Metabase)
          </span>
        </div>
        <a
          href="http://localhost:3000/collection/66-auto-windsurf-toast"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center text-sm text-blue-600 hover:text-blue-800"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          Open in Metabase
        </a>
      </div>
    </div>
  );
}
