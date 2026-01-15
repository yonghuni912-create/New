'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Plus, Search, Edit, Trash2, Save, X } from 'lucide-react';

interface IngredientMaster {
  id: string;
  category: string;
  koreanName: string;
  englishName: string;
  quantity: number;
  unit: string;
  yieldRate: number;
}

const CATEGORIES = [
  'Oil', 'Raw chicken', 'Sauce', 'Powder', 'Dry goods', 'Food', 'Produced', 'Others'
];

const UNITS = ['g', 'ml', 'ea', 'pcs', 'kg', 'L', 'lb', 'oz'];

export default function PricingPage() {
  const { data: session, status } = useSession();
  
  const [ingredients, setIngredients] = useState<IngredientMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    category: 'Food',
    koreanName: '',
    englishName: '',
    quantity: 0,
    unit: 'g',
    yieldRate: 100
  });

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login');
  }, [status]);

  useEffect(() => {
    loadIngredients();
  }, []);

  const loadIngredients = async () => {
    try {
      const res = await fetch('/api/ingredients');
      if (res.ok) {
        const data = await res.json();
        setIngredients(data);
      }
    } catch (error) {
      console.error('Failed to load ingredients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.koreanName || !formData.englishName) {
      alert('식재료명 (한글/영문)을 입력하세요');
      return;
    }

    try {
      const url = editingId ? `/api/ingredients/${editingId}` : '/api/ingredients';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        alert(editingId ? '수정되었습니다!' : '추가되었습니다!');
        resetForm();
        loadIngredients();
      } else {
        const error = await res.json();
        alert(`오류: ${error.error}`);
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/ingredients/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadIngredients();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const startEdit = (ingredient: IngredientMaster) => {
    setFormData({
      category: ingredient.category,
      koreanName: ingredient.koreanName,
      englishName: ingredient.englishName,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      yieldRate: ingredient.yieldRate
    });
    setEditingId(ingredient.id);
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      category: 'Food',
      koreanName: '',
      englishName: '',
      quantity: 0,
      unit: 'g',
      yieldRate: 100
    });
    setEditingId(null);
    setShowAddModal(false);
  };

  const filteredIngredients = ingredients.filter(ing => {
    const matchesSearch = !searchTerm || 
      ing.koreanName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ing.englishName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || ing.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ingredient Master</h1>
          <p className="text-slate-500">식재료 마스터 데이터 관리</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Ingredient
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search ingredients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Ingredients Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Category</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Ingredient Name (KR)</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Ingredient Name (EN)</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Quantity / Weight</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Unit</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Yield (%)</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredIngredients.map((ing) => (
              <tr key={ing.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {ing.category}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{ing.koreanName}</td>
                <td className="px-4 py-3">{ing.englishName}</td>
                <td className="px-4 py-3 text-right font-mono">{ing.quantity}</td>
                <td className="px-4 py-3 text-center">{ing.unit}</td>
                <td className="px-4 py-3 text-right font-mono">{ing.yieldRate}%</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => startEdit(ing)}
                      className="p-1 text-gray-400 hover:text-blue-500"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(ing.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredIngredients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No ingredients found. Add some to get started!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                {editingId ? 'Edit Ingredient' : 'Add New Ingredient'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingredient Name (KR) / 식재료명 (한글)
                </label>
                <input
                  type="text"
                  value={formData.koreanName}
                  onChange={(e) => setFormData({ ...formData, koreanName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="카놀라유"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingredient Name (EN) / 식재료명 (영문)
                </label>
                <input
                  type="text"
                  value={formData.englishName}
                  onChange={(e) => setFormData({ ...formData, englishName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Canola Oil"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity / Weight
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Yield (%) / 수율
                </label>
                <input
                  type="number"
                  value={formData.yieldRate}
                  onChange={(e) => setFormData({ ...formData, yieldRate: parseFloat(e.target.value) || 100 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={resetForm}
                className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center justify-center"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
