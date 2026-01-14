'use client';

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface StoresByCountry {
  country: string;
  count: number;
  color: string;
}

interface StoresByStatus {
  status: string;
  count: number;
  color: string;
}

interface DashboardChartsProps {
  storesByCountry: StoresByCountry[];
  storesByStatus: StoresByStatus[];
}

const COUNTRY_NAMES: Record<string, string> = {
  CA: '캐나다',
  US: '미국',
  MX: '멕시코',
  CO: '콜롬비아',
  PE: '페루',
  CL: '칠레',
  AR: '아르헨티나',
  BR: '브라질',
  GT: '과테말라',
  PA: '파나마',
};

const STATUS_NAMES: Record<string, string> = {
  PLANNING: '계획중',
  CONFIRMED: '확정',
  IN_PROGRESS: '진행중',
  OPENED: '오픈완료',
  ON_HOLD: '보류',
  CANCELLED: '취소',
};

const COLORS = [
  '#FF6B35', // BBQ Orange
  '#FF8C61',
  '#FFB088',
  '#DC143C', // BBQ Red
  '#E8484A',
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
];

export default function DashboardCharts({ storesByCountry, storesByStatus }: DashboardChartsProps) {
  // Prepare data with localized names
  const countryData = storesByCountry.map((item, idx) => ({
    ...item,
    name: COUNTRY_NAMES[item.country] || item.country,
    color: COLORS[idx % COLORS.length]
  }));

  const statusData = storesByStatus.map((item, idx) => ({
    ...item,
    name: STATUS_NAMES[item.status] || item.status,
    color: item.color || COLORS[idx % COLORS.length]
  }));

  const totalStores = storesByCountry.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Country Bar Chart */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">국가별 매장 현황</h3>
        <div className="h-[300px]">
          {countryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={countryData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip
                  formatter={(value) => [`${value}개 매장`, '매장 수']}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {countryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              데이터가 없습니다
            </div>
          )}
        </div>
        <div className="mt-4 text-center">
          <span className="text-3xl font-bold text-gray-800">{totalStores}</span>
          <span className="text-gray-500 ml-2">총 매장</span>
        </div>
      </div>

      {/* Status Pie Chart */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">진행 상태별 현황</h3>
        <div className="h-[300px]">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="name"
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={true}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value}개 매장`, name]}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              데이터가 없습니다
            </div>
          )}
        </div>
        {/* Legend */}
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          {statusData.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-gray-600">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
