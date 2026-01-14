
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

interface InventoryItem {
  id: string;
  ingredientMaster: {
    id: string;
    koreanName: string;
    englishName: string;
    unit: string;
    // category 필드가 API에서 올 수도 있으므로 옵셔널로 추가
    category?: string;
  };
  openingStock: number;
  stockIn: number;
  wastage: number;
  actualClosingStock: number;
  totalUsage: number;
  theoreticalUsage?: number;
  variance?: number;
}

interface PeriodDetail {
  id: string;
  startDate: string;
  endDate: string;
  group: { name: string };
  items: InventoryItem[];
}

interface PosSaleItem {
  posMenuLinkId: string;
  posMenuName: string;
  quantitySold: number;
}

export default function InventoryDetailPage({ params }: { params: Promise<{ periodId: string }> }) {
  // Next.js 15+ / React 19 호환: use() 훅으로 Promise 언래핑
  const { periodId } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales'>('inventory');
  
  // Data States
  const [period, setPeriod] = useState<PeriodDetail | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<PosSaleItem[]>([]);
  
  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 1. 초기 데이터 로딩
  useEffect(() => {
    fetchInventoryData();
    fetchSalesData();
  }, [periodId]);

  const fetchInventoryData = async () => {
    try {
      const res = await fetch(`/api/inventory/periods/${periodId}`);
      if (!res.ok) throw new Error('Failed to load period data');
      const data = await res.json();
      setPeriod(data);
      setItems(data.items);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSalesData = async () => {
    try {
      const res = await fetch(`/api/inventory/periods/${periodId}/sales`);
      if (res.ok) {
        const data = await res.json();
        setSales(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // 2. 재고 입력 핸들러
  const handleInventoryChange = (id: string, field: keyof InventoryItem, value: string) => {
    const numValue = parseFloat(value) || 0;
    setItems((prev) => prev.map((item) => {
      if (item.id === id) {
        const updated = { ...item, [field]: numValue };
        updated.totalUsage = 
          (field === 'openingStock' ? numValue : item.openingStock) +
          (field === 'stockIn' ? numValue : item.stockIn) -
          (field === 'wastage' ? numValue : item.wastage) -
          (field === 'actualClosingStock' ? numValue : item.actualClosingStock);
        return updated;
      }
      return item;
    }));
    setHasUnsavedChanges(true);
  };

  // 3. 판매량 입력 핸들러
  const handleSalesChange = (linkId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setSales((prev) => prev.map((item) => 
      item.posMenuLinkId === linkId ? { ...item, quantitySold: numValue } : item
    ));
    setHasUnsavedChanges(true);
  };

  // 4. 저장 핸들러 (탭에 따라 다른 API 호출)
  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (activeTab === 'inventory') {
        const payload = items.map(item => ({
          id: item.id,
          openingStock: item.openingStock,
          stockIn: item.stockIn,
          wastage: item.wastage,
          actualClosingStock: item.actualClosingStock
        }));
        
        const res = await fetch('/api/inventory/items/batch-update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: payload }),
        });
        
        if (!res.ok) throw new Error('Failed to save inventory');
        toast.success('Inventory saved');
      } else {
        const res = await fetch(`/api/inventory/periods/${periodId}/sales`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sales }),
        });
        
        if (!res.ok) throw new Error('Failed to save sales');
        toast.success('Sales saved & Analysis updated');
        // 판매량 저장 후 분석 결과가 바뀌므로 재고 데이터 새로고침
        fetchInventoryData(); 
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !period) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{period.group.name}</h1>
          <p className="text-sm text-gray-500">
            {format(new Date(period.startDate), 'MMM d')} ~ {format(new Date(period.endDate), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => router.back()}>Back</Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !hasUnsavedChanges}
            className={hasUnsavedChanges ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'inventory'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Inventory Count & Analysis
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sales'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Sales Input (POS Data)
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white rounded-lg shadow border border-gray-200 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          
          {/* 1. Inventory Tab */}
          {activeTab === 'inventory' && (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-64">Item</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">Unit</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-yellow-50 w-24">Opening</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-blue-50 w-24">In (+)</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-red-50 w-24">Waste (-)</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-green-50 w-24">Closing (-)</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-gray-100 w-24">Real Use</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-indigo-50 w-24">Theo Use</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-orange-50 w-24">Variance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="text-sm font-medium text-gray-900 truncate">{item.ingredientMaster.englishName}</div>
                      <div className="text-xs text-gray-500 truncate">{item.ingredientMaster.koreanName}</div>
                    </td>
                    <td className="px-2 py-2 text-center text-xs text-gray-500">{item.ingredientMaster.unit}</td>
                    
                    {/* Inputs */}
                    <td className="p-1"><Input type="number" className="text-right h-8 text-sm" value={item.openingStock} onChange={(e) => handleInventoryChange(item.id, 'openingStock', e.target.value)} /></td>
                    <td className="p-1"><Input type="number" className="text-right h-8 text-sm" value={item.stockIn} onChange={(e) => handleInventoryChange(item.id, 'stockIn', e.target.value)} /></td>
                    <td className="p-1"><Input type="number" className="text-right h-8 text-sm text-red-600" value={item.wastage} onChange={(e) => handleInventoryChange(item.id, 'wastage', e.target.value)} /></td>
                    <td className="p-1"><Input type="number" className="text-right h-8 text-sm font-bold" value={item.actualClosingStock} onChange={(e) => handleInventoryChange(item.id, 'actualClosingStock', e.target.value)} /></td>
                    
                    {/* Analysis Results */}
                    <td className="px-2 py-2 text-right text-sm font-bold bg-gray-50">{item.totalUsage?.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right text-sm text-indigo-700 bg-indigo-50">{item.theoreticalUsage?.toFixed(2) || '-'}</td>
                    <td className={`px-2 py-2 text-right text-sm font-bold bg-orange-50 ${
                      (item.variance || 0) > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {item.variance ? item.variance.toFixed(2) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 2. Sales Tab */}
          {activeTab === 'sales' && (
            <div className="p-6">
              {sales.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                  No POS menus linked. Go to Settings {'>'} POS Linking to setup.
                </div>
              ) : (
                <div className="max-w-2xl mx-auto">
                  <h3 className="text-lg font-medium mb-4">Enter Sales Quantity for this Period</h3>
                  <div className="bg-white rounded-lg border border-gray-200 divide-y">
                    {sales.map((sale) => (
                      <div key={sale.posMenuLinkId} className="flex justify-between items-center p-4 hover:bg-gray-50">
                        <span className="font-medium text-gray-700">{sale.posMenuName}</span>
                        <div className="w-32 flex items-center gap-2">
                          <Input 
                            type="number" 
                            className="text-right"
                            value={sale.quantitySold}
                            onChange={(e) => handleSalesChange(sale.posMenuLinkId, e.target.value)}
                          />
                          <span className="text-sm text-gray-500">Qty</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
