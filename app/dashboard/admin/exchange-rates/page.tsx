'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { 
  ArrowRightLeft, Plus, RefreshCw, Edit, DollarSign, Globe, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  asOf: string;
  source: string | null;
}

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'COP', name: 'Colombian Peso', symbol: '$' },
  { code: 'KRW', name: 'Korean Won', symbol: '₩' },
];

const DEFAULT_RATES: Record<string, number> = {
  CAD: 1.36,
  MXN: 17.15,
  COP: 3950,
  KRW: 1320,
};

export default function ExchangeRatesPage() {
  const { data: session, status } = useSession();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [userInputRate, setUserInputRate] = useState<string>('');
  const [selectedFromCurrency, setSelectedFromCurrency] = useState('USD');
  const [selectedToCurrency, setSelectedToCurrency] = useState('CAD');
  
  const [formData, setFormData] = useState({
    fromCurrency: 'USD',
    toCurrency: 'CAD',
    rate: '',
    source: 'manual'
  });

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login');
  }, [status]);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      // Use default rates for now
      const defaultRates = Object.entries(DEFAULT_RATES).map(([currency, rate], idx) => ({
        id: `default_${idx}`,
        fromCurrency: 'USD',
        toCurrency: currency,
        rate,
        asOf: new Date().toISOString(),
        source: 'default'
      }));
      setRates(defaultRates);
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newRate: ExchangeRate = {
      id: `rate_${Date.now()}`,
      fromCurrency: formData.fromCurrency,
      toCurrency: formData.toCurrency,
      rate: parseFloat(formData.rate),
      asOf: new Date().toISOString(),
      source: formData.source
    };
    
    setRates([...rates.filter(r => r.toCurrency !== newRate.toCurrency), newRate]);
    toast.success('Exchange rate saved');
    setShowModal(false);
  };

  const calculateWithUserRate = (amount: number, fromCurrency: string, toCurrency: string) => {
    const rate = rates.find(r => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency);
    const effectiveRate = userInputRate ? parseFloat(userInputRate) : rate?.rate || DEFAULT_RATES[toCurrency] || 1;
    return amount * effectiveRate;
  };

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="w-7 h-7 text-orange-500" />
            Exchange Rate Management
          </h1>
          <p className="text-gray-500 mt-1">환율 관리 - 국가별 기준 환율 설정</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRates}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Rate
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">환율 기준 안내</h3>
            <p className="text-sm text-blue-700 mt-1">
              아래 환율은 각 국가별 고정 환율입니다. 실제 환율과 차이가 있을 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Quick Conversion
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <select
              value={selectedFromCurrency}
              onChange={(e) => setSelectedFromCurrency(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <select
              value={selectedToCurrency}
              onChange={(e) => setSelectedToCurrency(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom Rate</label>
            <input
              type="number"
              value={userInputRate}
              onChange={(e) => setUserInputRate(e.target.value)}
              placeholder="Enter rate..."
              className="w-full px-3 py-2 border rounded-lg"
              step="0.0001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
            <div className="px-3 py-2 bg-gray-100 rounded-lg text-lg font-medium">
              1 {selectedFromCurrency} = {calculateWithUserRate(1, selectedFromCurrency, selectedToCurrency).toFixed(4)} {selectedToCurrency}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            Current Exchange Rates (Base: USD)
          </h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate (1 USD =)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Updated</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rates.map(rate => {
              const currency = CURRENCIES.find(c => c.code === rate.toCurrency);
              return (
                <tr key={rate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="font-medium">{rate.toCurrency}</span>
                    <span className="text-sm text-gray-500 ml-2">({currency?.name})</span>
                  </td>
                  <td className="px-6 py-4 text-lg font-semibold">
                    {currency?.symbol}{rate.rate.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 capitalize">{rate.source}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(rate.asOf).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">Add Exchange Rate</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <select
                    value={formData.fromCurrency}
                    onChange={(e) => setFormData({ ...formData, fromCurrency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <select
                    value={formData.toCurrency}
                    onChange={(e) => setFormData({ ...formData, toCurrency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate *</label>
                <input
                  type="number"
                  required
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  step="0.0001"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
