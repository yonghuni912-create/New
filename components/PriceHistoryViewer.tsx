'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { TrendingUp, TrendingDown, Minus, Search, Filter, Calendar, Download } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface PriceRecord {
  id: string;
  ingredientId: string;
  ingredient: {
    id: string;
    name: string;
    nameKo?: string;
    unit: string;
    category?: string;
  };
  vendorId: string;
  vendor: {
    id: string;
    name: string;
  };
  price: number;
  effectiveDate: string;
  createdAt: string;
}

interface PriceHistoryViewerProps {
  countryId?: string;
}

export default function PriceHistoryViewer({ countryId }: PriceHistoryViewerProps) {
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [groupedData, setGroupedData] = useState<Record<string, PriceRecord[]>>({});

  useEffect(() => {
    fetchPriceHistory();
  }, [countryId, dateRange]);

  const fetchPriceHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (countryId) params.append('countryId', countryId);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      
      const res = await fetch(`/api/price-history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
        
        // Group by ingredient
        const grouped: Record<string, PriceRecord[]> = {};
        data.forEach((record: PriceRecord) => {
          const key = record.ingredientId;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(record);
        });
        
        // Sort each group by date
        Object.keys(grouped).forEach(key => {
          grouped[key].sort((a, b) => 
            new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
          );
        });
        
        setGroupedData(grouped);
      }
    } catch (e) {
      console.error('Failed to fetch price history:', e);
    }
    setLoading(false);
  };

  const getPriceChange = (records: PriceRecord[]) => {
    if (records.length < 2) return { change: 0, percentage: 0 };
    const latest = records[0].price;
    const previous = records[1].price;
    const change = latest - previous;
    const percentage = previous > 0 ? ((change / previous) * 100) : 0;
    return { change, percentage };
  };

  const filteredIngredients = Object.entries(groupedData).filter(([id, recs]) => {
    if (!searchQuery) return true;
    const name = recs[0]?.ingredient?.name?.toLowerCase() || '';
    const nameKo = recs[0]?.ingredient?.nameKo?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return name.includes(query) || nameKo.includes(query);
  });

  const exportToCSV = () => {
    const headers = ['Ingredient', 'Vendor', 'Price', 'Unit', 'Effective Date', 'Category'];
    const rows = records.map(r => [
      r.ingredient.name,
      r.vendor.name,
      r.price.toString(),
      r.ingredient.unit,
      format(parseISO(r.effectiveDate), 'yyyy-MM-dd'),
      r.ingredient.category || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `price-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ingredients..."
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-36"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-36"
            />
          </div>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Ingredients</p>
          <p className="text-2xl font-bold">{Object.keys(groupedData).length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Price Records</p>
          <p className="text-2xl font-bold">{records.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Price Changes</p>
          <p className="text-2xl font-bold">
            {Object.values(groupedData).filter(g => g.length > 1).length}
          </p>
        </div>
      </div>

      {/* Price History Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ingredient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Updated</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">History</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Loading price history...
                  </td>
                </tr>
              ) : filteredIngredients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No price history found
                  </td>
                </tr>
              ) : (
                filteredIngredients.map(([ingredientId, recs]) => {
                  const latest = recs[0];
                  const { change, percentage } = getPriceChange(recs);
                  const isUp = change > 0;
                  const isDown = change < 0;
                  
                  return (
                    <tr key={ingredientId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-sm">{latest.ingredient.name}</p>
                          {latest.ingredient.nameKo && (
                            <p className="text-xs text-gray-500">{latest.ingredient.nameKo}</p>
                          )}
                          {latest.ingredient.category && (
                            <span className="inline-block mt-1 text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {latest.ingredient.category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">
                          ${latest.price.toFixed(2)}
                        </span>
                        <span className="text-gray-500 text-sm ml-1">
                          /{latest.ingredient.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {recs.length > 1 ? (
                          <div className={`flex items-center gap-1 ${isUp ? 'text-red-600' : isDown ? 'text-green-600' : 'text-gray-500'}`}>
                            {isUp ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : isDown ? (
                              <TrendingDown className="w-4 h-4" />
                            ) : (
                              <Minus className="w-4 h-4" />
                            )}
                            <span className="text-sm font-medium">
                              {isUp ? '+' : ''}{percentage.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{latest.vendor.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {format(parseISO(latest.effectiveDate), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedIngredient(
                            selectedIngredient === ingredientId ? null : ingredientId
                          )}
                          className="text-sm text-orange-600 hover:text-orange-700"
                        >
                          {recs.length} record{recs.length > 1 ? 's' : ''}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Ingredient History Detail */}
      {selectedIngredient && groupedData[selectedIngredient] && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-lg font-semibold mb-4">
            Price History: {groupedData[selectedIngredient][0].ingredient.name}
          </h3>
          <div className="space-y-2">
            {groupedData[selectedIngredient].map((record, idx) => {
              const prevRecord = groupedData[selectedIngredient][idx + 1];
              const change = prevRecord ? record.price - prevRecord.price : 0;
              
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500 w-24">
                      {format(parseISO(record.effectiveDate), 'MMM d, yyyy')}
                    </div>
                    <div className="font-semibold">
                      ${record.price.toFixed(2)}
                      <span className="text-gray-500 font-normal ml-1">
                        /{record.ingredient.unit}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {prevRecord && (
                      <span className={`text-sm ${change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        {change > 0 ? '+' : ''}{change.toFixed(2)}
                      </span>
                    )}
                    <span className="text-sm text-gray-500">{record.vendor.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
