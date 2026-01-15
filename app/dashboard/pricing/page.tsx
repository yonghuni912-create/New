'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Plus, Search, Edit, Trash2, Save, X, Globe, DollarSign, ChevronDown, ChevronRight, Copy } from 'lucide-react';

interface IngredientMaster {
  id: string;
  category: string;
  koreanName: string;
  englishName: string;
  quantity: number;
  unit: string;
  yieldRate: number;
}

interface PriceTemplate {
  id: string;
  name: string;
  country: string;
  region?: string;
  currency: string;
  description?: string;
  isActive: boolean;
  items?: PriceTemplateItem[];
}

interface PriceTemplateItem {
  id: string;
  ingredientMasterId: string;
  unitPrice: number;
  packagingUnit?: string;
  packagingQty?: number;
  notes?: string;
  // 국가별 독자 필드 (null이면 마스터 값 사용)
  localEnglishName?: string;
  localKoreanName?: string;
  localQuantity?: number;
  localUnit?: string;
  localYieldRate?: number;
  // From join (마스터 데이터)
  category?: string;
  koreanName?: string;
  englishName?: string;
  quantity?: number;
  unit?: string;
  yieldRate?: number;
}

const CATEGORIES = [
  'All', 'Oil', 'Raw chicken', 'Sauce', 'Powder', 'Dry goods', 'Food', 'Produced', 'Packaging', 'Others'
];

const UNITS = ['g', 'ml', 'ea', 'pcs', 'kg', 'L', 'lb', 'oz', 'bag'];

const CURRENCIES = [
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'KRW', symbol: '₩', name: 'Korean Won' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
];

export default function PricingPage() {
  const { data: session, status } = useSession();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'master' | 'templates'>('master');
  
  // Master ingredients state
  const [ingredients, setIngredients] = useState<IngredientMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  
  // Price templates state
  const [templates, setTemplates] = useState<PriceTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PriceTemplate | null>(null);
  const [templateItems, setTemplateItems] = useState<PriceTemplateItem[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['All']));
  
  // Modals
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientMaster | null>(null);
  
  // Form data
  const [ingredientForm, setIngredientForm] = useState({
    category: 'Food',
    koreanName: '',
    englishName: '',
    quantity: 0,
    unit: 'g',
    yieldRate: 100
  });
  
  const [templateForm, setTemplateForm] = useState({
    name: '',
    country: '',
    region: '',
    currency: 'CAD',
    description: '',
    copyFromMaster: true
  });

  // Editing price items - now tracks full item changes including local fields
  const [editingItems, setEditingItems] = useState<Map<string, Partial<PriceTemplateItem>>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Modal for editing template item details
  const [editingTemplateItem, setEditingTemplateItem] = useState<PriceTemplateItem | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login');
  }, [status]);

  useEffect(() => {
    loadIngredients();
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateItems(selectedTemplate.id);
    }
  }, [selectedTemplate]);

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

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/price-templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadTemplateItems = async (templateId: string) => {
    try {
      const res = await fetch(`/api/price-templates/${templateId}/items`);
      if (res.ok) {
        const data = await res.json();
        setTemplateItems(data);
        // Reset editing state
        setEditingItems(new Map());
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error('Failed to load template items:', error);
    }
  };

  // Filter ingredients
  const filteredIngredients = ingredients.filter(ing => {
    const matchSearch = searchTerm === '' || 
      ing.koreanName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ing.englishName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = categoryFilter === 'All' || ing.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  // Group template items by category
  const groupedItems = templateItems.reduce((acc, item) => {
    const cat = item.category || 'Others';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, PriceTemplateItem[]>);

  // Handlers
  const handleAddIngredient = async () => {
    if (!ingredientForm.koreanName || !ingredientForm.englishName) {
      alert('식재료명을 입력하세요');
      return;
    }

    try {
      const url = editingIngredient 
        ? `/api/ingredients/${editingIngredient.id}` 
        : '/api/ingredients';
      
      const res = await fetch(url, {
        method: editingIngredient ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ingredientForm)
      });

      if (res.ok) {
        alert(editingIngredient ? '수정되었습니다!' : '추가되었습니다!');
        setShowAddIngredient(false);
        setEditingIngredient(null);
        resetIngredientForm();
        loadIngredients();
      } else {
        const error = await res.json();
        alert(`오류: ${error.error}`);
      }
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const handleDeleteIngredient = async (id: string) => {
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

  const handleCreateTemplate = async () => {
    if (!templateForm.name || !templateForm.country) {
      alert('템플릿명과 국가를 입력하세요');
      return;
    }

    try {
      const res = await fetch('/api/price-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm)
      });

      if (res.ok) {
        alert('가격 템플릿이 생성되었습니다!');
        setShowAddTemplate(false);
        resetTemplateForm();
        loadTemplates();
      } else {
        const error = await res.json();
        alert(`오류: ${error.error}`);
      }
    } catch (error) {
      console.error('Create template error:', error);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('이 가격 템플릿을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/price-templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedTemplate?.id === id) {
          setSelectedTemplate(null);
          setTemplateItems([]);
        }
        loadTemplates();
      }
    } catch (error) {
      console.error('Delete template error:', error);
    }
  };

  // Handle field change for template item (inline editing)
  const handleItemFieldChange = (itemId: string, field: keyof PriceTemplateItem, value: any) => {
    const newEditingItems = new Map(editingItems);
    const currentEdits = newEditingItems.get(itemId) || {};
    newEditingItems.set(itemId, { ...currentEdits, [field]: value });
    setEditingItems(newEditingItems);
    setHasUnsavedChanges(true);
  };

  // Get effective value (edited or original)
  const getEffectiveValue = (item: PriceTemplateItem, field: keyof PriceTemplateItem) => {
    const edits = editingItems.get(item.id);
    if (edits && edits[field] !== undefined) {
      return edits[field];
    }
    return item[field];
  };

  // Get display value with local override
  const getDisplayValue = (item: PriceTemplateItem, localField: keyof PriceTemplateItem, masterField: keyof PriceTemplateItem) => {
    const edits = editingItems.get(item.id);
    if (edits && edits[localField] !== undefined) {
      return edits[localField];
    }
    // Return local value if exists, otherwise master value
    return item[localField] ?? item[masterField];
  };

  const handleSaveItems = async () => {
    if (!selectedTemplate) return;

    const items = templateItems.map(item => {
      const edits = editingItems.get(item.id) || {};
      return {
        id: item.id,
        unitPrice: edits.unitPrice ?? item.unitPrice,
        packagingUnit: edits.packagingUnit ?? item.packagingUnit,
        packagingQty: edits.packagingQty ?? item.packagingQty,
        notes: edits.notes ?? item.notes,
        localEnglishName: edits.localEnglishName ?? item.localEnglishName,
        localKoreanName: edits.localKoreanName ?? item.localKoreanName,
        localQuantity: edits.localQuantity ?? item.localQuantity,
        localUnit: edits.localUnit ?? item.localUnit,
        localYieldRate: edits.localYieldRate ?? item.localYieldRate,
      };
    });

    try {
      const res = await fetch(`/api/price-templates/${selectedTemplate.id}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });

      if (res.ok) {
        alert('변경 사항이 저장되었습니다!');
        setHasUnsavedChanges(false);
        setEditingItems(new Map());
        loadTemplateItems(selectedTemplate.id);
      }
    } catch (error) {
      console.error('Save items error:', error);
    }
  };

  const toggleCategory = (cat: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(cat)) {
      newExpanded.delete(cat);
    } else {
      newExpanded.add(cat);
    }
    setExpandedCategories(newExpanded);
  };

  const resetIngredientForm = () => {
    setIngredientForm({
      category: 'Food',
      koreanName: '',
      englishName: '',
      quantity: 0,
      unit: 'g',
      yieldRate: 100
    });
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      country: '',
      region: '',
      currency: 'CAD',
      description: '',
      copyFromMaster: true
    });
  };

  const getCurrencySymbol = (code: string) => {
    return CURRENCIES.find(c => c.code === code)?.symbol || '$';
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Pricing Management</h1>
        <p className="text-gray-500">식재료 마스터 및 국가별 가격 템플릿 관리</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('master')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'master' 
              ? 'border-orange-500 text-orange-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Edit className="w-4 h-4" />
            Master (기본 정보)
          </span>
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'templates' 
              ? 'border-orange-500 text-orange-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Price Templates (국가별 가격)
          </span>
        </button>
      </div>

      {/* Master Tab */}
      {activeTab === 'master' && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="식재료 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg w-64"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => { setShowAddIngredient(true); setEditingIngredient(null); resetIngredientForm(); }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              <Plus className="w-4 h-4" />
              식재료 추가
            </button>
          </div>

          {/* Ingredients Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">카테고리</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">식재료명 (한글)</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Ingredient (EN)</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">기본 수량</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">단위</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">수율 (%)</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredIngredients.map(ing => (
                  <tr key={ing.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-gray-100 rounded text-gray-700">{ing.category}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{ing.koreanName}</td>
                    <td className="px-4 py-3 text-gray-600">{ing.englishName}</td>
                    <td className="px-4 py-3 text-right">{ing.quantity}</td>
                    <td className="px-4 py-3 text-center">{ing.unit}</td>
                    <td className="px-4 py-3 text-right">{ing.yieldRate}%</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingIngredient(ing);
                            setIngredientForm(ing);
                            setShowAddIngredient(true);
                          }}
                          className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteIngredient(ing.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
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
                      등록된 식재료가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-sm text-gray-500">
            총 {filteredIngredients.length}개 / 전체 {ingredients.length}개
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Templates List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">가격 템플릿</h3>
                <button
                  onClick={() => setShowAddTemplate(true)}
                  className="p-1 text-orange-500 hover:bg-orange-50 rounded"
                  title="새 템플릿 생성"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-2">
                {templates.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    아직 가격 템플릿이 없습니다.<br/>
                    + 버튼을 눌러 생성하세요.
                  </p>
                ) : (
                  templates.map(tmpl => (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedTemplate?.id === tmpl.id
                          ? 'bg-orange-50 border-2 border-orange-500'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{tmpl.name}</div>
                          <div className="text-sm text-gray-500">
                            {tmpl.country}{tmpl.region ? `, ${tmpl.region}` : ''} • {tmpl.currency}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tmpl.id); }}
                          className="p-1 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Template Items */}
          <div className="lg:col-span-3">
            {selectedTemplate ? (
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedTemplate.name}</h3>
                    <p className="text-sm text-gray-500">
                      {selectedTemplate.country}{selectedTemplate.region ? `, ${selectedTemplate.region}` : ''} 
                      • 화폐: {selectedTemplate.currency}
                    </p>
                  </div>
                  {hasUnsavedChanges && (
                    <button
                      onClick={handleSaveItems}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      <Save className="w-4 h-4" />
                      변경 사항 저장
                    </button>
                  )}
                </div>

                <div className="p-4">
                  {Object.keys(groupedItems).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                      <p>이 템플릿에 아이템이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 mb-2">
                        💡 국가별로 다른 제품을 사용할 경우, 해당 템플릿에서 영문명/수량/단위를 수정하면 이 템플릿에만 적용됩니다.
                      </p>
                      {Object.entries(groupedItems).map(([category, items]) => (
                        <div key={category} className="border rounded-lg">
                          <button
                            onClick={() => toggleCategory(category)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
                          >
                            <span className="font-medium">
                              {category} ({items.length})
                            </span>
                            {expandedCategories.has(category) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          
                          {expandedCategories.has(category) && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left w-28">식재료명(한)</th>
                                    <th className="px-3 py-2 text-left w-40">현지 영문명</th>
                                    <th className="px-3 py-2 text-right w-20">수량</th>
                                    <th className="px-3 py-2 text-center w-16">단위</th>
                                    <th className="px-3 py-2 text-right w-24">
                                      단가 ({getCurrencySymbol(selectedTemplate.currency)})
                                    </th>
                                    <th className="px-3 py-2 text-left w-28">포장단위</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {items.map(item => {
                                    const isEdited = editingItems.has(item.id);
                                    return (
                                      <tr key={item.id} className={`hover:bg-gray-50 ${isEdited ? 'bg-yellow-50' : ''}`}>
                                        <td className="px-3 py-2 text-gray-700">{item.koreanName}</td>
                                        <td className="px-3 py-1">
                                          <input
                                            type="text"
                                            value={getDisplayValue(item, 'localEnglishName', 'englishName') || ''}
                                            onChange={(e) => handleItemFieldChange(item.id, 'localEnglishName', e.target.value)}
                                            className="w-full px-2 py-1 border rounded text-sm"
                                            placeholder={item.englishName}
                                          />
                                        </td>
                                        <td className="px-3 py-1">
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={getDisplayValue(item, 'localQuantity', 'quantity') ?? ''}
                                            onChange={(e) => handleItemFieldChange(item.id, 'localQuantity', parseFloat(e.target.value) || null)}
                                            className="w-full px-2 py-1 border rounded text-right text-sm"
                                            placeholder={String(item.quantity || 0)}
                                          />
                                        </td>
                                        <td className="px-3 py-1">
                                          <select
                                            value={getDisplayValue(item, 'localUnit', 'unit') || ''}
                                            onChange={(e) => handleItemFieldChange(item.id, 'localUnit', e.target.value)}
                                            className="w-full px-1 py-1 border rounded text-sm"
                                          >
                                            <option value="">{item.unit}</option>
                                            {UNITS.map(u => (
                                              <option key={u} value={u}>{u}</option>
                                            ))}
                                          </select>
                                        </td>
                                        <td className="px-3 py-1">
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={getEffectiveValue(item, 'unitPrice') ?? item.unitPrice}
                                            onChange={(e) => handleItemFieldChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 border rounded text-right text-sm"
                                          />
                                        </td>
                                        <td className="px-3 py-1">
                                          <input
                                            type="text"
                                            value={getEffectiveValue(item, 'packagingUnit') || ''}
                                            onChange={(e) => handleItemFieldChange(item.id, 'packagingUnit', e.target.value)}
                                            className="w-full px-2 py-1 border rounded text-sm"
                                            placeholder="예: 1박스"
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <Globe className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">가격 템플릿을 선택하세요</h3>
                <p className="text-gray-500">
                  왼쪽 목록에서 템플릿을 선택하거나<br/>
                  + 버튼을 눌러 새 템플릿을 생성하세요.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Ingredient Modal */}
      {showAddIngredient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg">
                {editingIngredient ? '식재료 수정' : '식재료 추가'}
              </h3>
              <button onClick={() => { setShowAddIngredient(false); setEditingIngredient(null); }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">카테고리</label>
                <select
                  value={ingredientForm.category}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">식재료명 (한글) *</label>
                <input
                  type="text"
                  value={ingredientForm.koreanName}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, koreanName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 카놀라유"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ingredient Name (EN) *</label>
                <input
                  type="text"
                  value={ingredientForm.englishName}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, englishName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g. Canola Oil"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">기본 수량</label>
                  <input
                    type="number"
                    value={ingredientForm.quantity}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">단위</label>
                  <select
                    value={ingredientForm.unit}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">수율 (%)</label>
                  <input
                    type="number"
                    value={ingredientForm.yieldRate}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, yieldRate: parseFloat(e.target.value) || 100 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => { setShowAddIngredient(false); setEditingIngredient(null); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleAddIngredient}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                {editingIngredient ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Template Modal */}
      {showAddTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg">새 가격 템플릿 생성</h3>
              <button onClick={() => setShowAddTemplate(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">템플릿명 *</label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: Vancouver, CA"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">국가 *</label>
                  <input
                    type="text"
                    value={templateForm.country}
                    onChange={(e) => setTemplateForm({ ...templateForm, country: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: Canada"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">지역</label>
                  <input
                    type="text"
                    value={templateForm.region}
                    onChange={(e) => setTemplateForm({ ...templateForm, region: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="예: Vancouver"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">화폐</label>
                <select
                  value={templateForm.currency}
                  onChange={(e) => setTemplateForm({ ...templateForm, currency: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {CURRENCIES.map(curr => (
                    <option key={curr.code} value={curr.code}>
                      {curr.code} ({curr.symbol}) - {curr.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">설명</label>
                <textarea
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="템플릿에 대한 설명..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="copyFromMaster"
                  checked={templateForm.copyFromMaster}
                  onChange={(e) => setTemplateForm({ ...templateForm, copyFromMaster: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="copyFromMaster" className="text-sm">
                  마스터 템플릿의 모든 식재료를 복사 (가격은 0으로 시작)
                </label>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowAddTemplate(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleCreateTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                <Copy className="w-4 h-4" />
                템플릿 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
