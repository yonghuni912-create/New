'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { FileText, Download, Plus, Trash2, Eye, Save, RefreshCw, Settings, Table, Search, X, Edit, ChevronDown, Upload, Image, ChevronUp, Archive, History } from 'lucide-react';

// 타입 정의
interface IngredientSuggestion {
  id: string;
  koreanName: string;
  englishName: string;
  category: string;
  unit: string;
  yieldRate: number;
  price?: number | null;
  currency?: string | null;
}

interface ManualIngredient {
  no: number;
  name: string;
  koreanName: string;
  weight: string;
  unit: string;
  purchase: string;
  ingredientId?: string;
  price?: number | null;
  currency?: string | null;
}

interface CookingStep {
  process: string;
  manual: string;
  translatedManual?: string;
}

interface ManualGroup {
  id: string;
  name: string;
  description?: string;
  templateId?: string;
  currency: string;
  template?: {
    id: string;
    name: string;
    country?: string;
  };
  manuals?: SavedManual[];
}

interface SavedManual {
  id: string;
  name: string;
  koreanName?: string;
  shelfLife?: string;
  yield?: number;
  sellingPrice?: number;
  groupId?: string;
  group?: ManualGroup;
  costVersions?: CostVersion[];
  ingredients?: any[];
  isDeleted?: boolean;
  isArchived?: boolean;
}

interface CostVersion {
  id: string;
  totalCost: number;
  currency: string;
  templateId?: string;
  template?: { 
    id: string;
    name: string; 
    country?: string;
  };
}

interface PriceTemplate {
  id: string;
  name: string;
  country?: string;
  region?: string;
  currency?: string;
}

const DEFAULT_COOKING_PROCESSES = [
  'Ingredients Preparation',
  'Marination',
  'Batter Mix Solution Preparation',
  'Battering',
  'Breading',
  'Frying',
  'Assemble',
  'Serve',
  'Take Out & Delivery'
];

const EMPTY_INGREDIENT: ManualIngredient = {
  no: 1,
  name: '',
  koreanName: '',
  weight: '',
  unit: 'g',
  purchase: 'Local',
  ingredientId: undefined
};

export default function TemplatesPage() {
  const { data: session } = useSession();
  const isMaster = session?.user?.email === 'kun.lee@bbqchickenca.com';
  const [activeTab, setActiveTab] = useState<'editor' | 'manuals' | 'costTable' | 'trash' | 'archived'>('editor');
  
  // Editor State
  const [menuName, setMenuName] = useState('');
  const [menuNameKo, setMenuNameKo] = useState('');
  const [shelfLife, setShelfLife] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [ingredients, setIngredients] = useState<ManualIngredient[]>([{ ...EMPTY_INGREDIENT }]);
  const [cookingSteps, setCookingSteps] = useState<CookingStep[]>(
    DEFAULT_COOKING_PROCESSES.map(p => ({ process: p, manual: '', translatedManual: '' }))
  );
  const [showPreview, setShowPreview] = useState(false);
  
  // Ingredient Search
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [activeIngredientIndex, setActiveIngredientIndex] = useState<number | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Data State
  const [manualGroups, setManualGroups] = useState<ManualGroup[]>([]);
  const [savedManuals, setSavedManuals] = useState<SavedManual[]>([]);
  const [priceTemplates, setPriceTemplates] = useState<PriceTemplate[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedTemplateFilter, setSelectedTemplateFilter] = useState<string>(''); // 템플릿 기반 필터
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Preview/Edit Modal State
  const [previewManual, setPreviewManual] = useState<SavedManual | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [editingManualId, setEditingManualId] = useState<string | null>(null);
  
  // Selection State for bulk operations
  const [selectedManualIds, setSelectedManualIds] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  // Sorting state for manuals table
  const [sortField, setSortField] = useState<'name' | 'country' | 'cost' | 'sellingPrice' | 'costPct' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Editor template selection
  const [editorTemplateId, setEditorTemplateId] = useState<string>('');
  
  // Image upload state
  const [menuImage, setMenuImage] = useState<File | null>(null);
  const [menuImageName, setMenuImageName] = useState<string>('');
  const [menuImageUrl, setMenuImageUrl] = useState<string>(''); // Base64 또는 URL

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Load data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    console.log('📡 Fetching data...');
    try {
      // Fetch manuals and price templates in parallel
      const [manualsRes, templatesRes] = await Promise.all([
        fetch('/api/manuals', { cache: 'no-store' }),
        fetch('/api/price-templates', { cache: 'no-store' })
      ]);

      if (manualsRes.ok) {
        const manuals = await manualsRes.json();
        console.log('✅ Manuals loaded:', manuals.length);
        setSavedManuals(manuals);
      } else {
        let errorText = '';
        try {
          const errorData = await manualsRes.json();
          errorText = JSON.stringify(errorData, null, 2);
          console.error('❌ Failed to load manuals:', manualsRes.status);
          console.error('Error details:', errorText);
        } catch {
          errorText = await manualsRes.text();
          console.error('❌ Failed to load manuals:', manualsRes.status);
          console.error('Raw error:', errorText);
        }
      }
      
      // Load price templates
      if (templatesRes.ok) {
        const templates = await templatesRes.json();
        console.log('✅ Price templates loaded:', templates.length);
        setPriceTemplates(templates);
        
        // Auto-select first template if available
        if (templates.length > 0 && !editorTemplateId) {
          setEditorTemplateId(templates[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update ingredient prices when template changes
  useEffect(() => {
    if (editorTemplateId && activeTab === 'editor') {
      updatePricesFromTemplate(editorTemplateId);
    }
  }, [editorTemplateId, activeTab]);

  const updatePricesFromTemplate = async (templateId: string) => {
    if (!templateId) return;
    
    try {
      // Fetch template items from price-templates API
      const res = await fetch(`/api/price-templates/${templateId}/items`);
      if (res.ok) {
        const templateItems = await res.json();
        
        // Get currency from selected template
        const selectedTemplate = priceTemplates.find(t => t.id === templateId);
        const currency = selectedTemplate?.currency || 'CAD';
        
        // Update prices in current ingredients list
        setIngredients(prevIngredients => {
          return prevIngredients.map(ing => {
            if (!ing.ingredientId) return ing;
            
            // Find matching template item by ingredientMasterId
            const templateItem = templateItems.find((item: any) => item.ingredientMasterId === ing.ingredientId);
            
            if (templateItem) {
              return {
                ...ing,
                price: templateItem.unitPrice,
                currency: currency
              };
            }
            return ing;
          });
        });
      }
    } catch (error) {
      console.error('Failed to update prices from template:', error);
    }
  };

  // Ingredient search
  const searchIngredients = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      return;
    }

    try {
      const url = `/api/ingredients/search?q=${encodeURIComponent(query)}&limit=8`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }, []);

  const handleIngredientInput = (index: number, value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], koreanName: value, name: value };
    setIngredients(newIngredients);
    setActiveIngredientIndex(index);

    // Debounced search
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchIngredients(value), 300);
  };

  const selectIngredient = async (index: number, suggestion: IngredientSuggestion) => {
    // Get price from selected template
    let price = 0;
    let currency = 'CAD';
    
    if (editorTemplateId) {
      try {
        const res = await fetch(`/api/price-templates/${editorTemplateId}/items`);
        if (res.ok) {
          const items = await res.json();
          const item = items.find((i: any) => i.ingredientMasterId === suggestion.id);
          if (item) {
            price = item.unitPrice;
          }
        }
        // Get currency from template
        const template = priceTemplates.find(t => t.id === editorTemplateId);
        if (template?.currency) {
          currency = template.currency;
        }
      } catch (error) {
        console.error('Failed to get price from template:', error);
      }
    }
    
    const newIngredients = [...ingredients];
    newIngredients[index] = {
      ...newIngredients[index],
      name: suggestion.englishName,
      koreanName: suggestion.koreanName,
      unit: suggestion.unit,
      ingredientId: suggestion.id,
      price: price,
      currency: currency
    };
    setIngredients(newIngredients);
    setSuggestions([]);
    setActiveIngredientIndex(null);
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { ...EMPTY_INGREDIENT, no: ingredients.length + 1 }]);
  };

  const removeIngredient = (index: number) => {
    const newIngredients = ingredients.filter((_, i) => i !== index)
      .map((ing, i) => ({ ...ing, no: i + 1 }));
    setIngredients(newIngredients);
  };

  const updateIngredient = (index: number, field: keyof ManualIngredient, value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const updateCookingStep = (index: number, value: string) => {
    const newSteps = [...cookingSteps];
    newSteps[index] = { ...newSteps[index], manual: value };
    setCookingSteps(newSteps);
  };

  // AI Translation for cooking method
  const translateCookingMethod = async (index: number) => {
    const step = cookingSteps[index];
    if (!step.manual) return;

    setIsTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: step.manual })
      });

      if (res.ok) {
        const data = await res.json();
        console.log('Single step translation result:', data);
        const newSteps = [...cookingSteps];
        if (data.finalTranslation && data.finalTranslation !== data.original) {
          newSteps[index] = { ...newSteps[index], translatedManual: data.finalTranslation };
        } else if (data.aiError) {
          newSteps[index] = { ...newSteps[index], translatedManual: `[번역 실패: ${data.aiError}]` };
        } else {
          newSteps[index] = { ...newSteps[index], translatedManual: `[번역 실패]` };
        }
        setCookingSteps(newSteps);
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  // Translate all cooking methods
  const translateAllCookingMethods = async () => {
    setIsTranslating(true);
    const newSteps = [...cookingSteps];
    
    for (let i = 0; i < newSteps.length; i++) {
      if (newSteps[i].manual) {
        try {
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: newSteps[i].manual })
          });
          if (res.ok) {
            const data = await res.json();
            console.log('Translation result for step', i, ':', data);
            
            // Always use finalTranslation if available
            if (data.finalTranslation && data.finalTranslation !== data.original) {
              newSteps[i] = { ...newSteps[i], translatedManual: data.finalTranslation };
            } else if (data.aiError) {
              console.warn('AI translation failed:', data.aiError);
              // Show error message in red
              newSteps[i] = { ...newSteps[i], translatedManual: `[번역 실패: ${data.aiError}]` };
            } else {
              // If translation returned same text, show error
              newSteps[i] = { ...newSteps[i], translatedManual: `[번역 실패: API 키를 확인해주세요]` };
            }
          } else {
            const errorText = await res.text();
            console.error('Translation API error:', res.status, errorText);
            newSteps[i] = { ...newSteps[i], translatedManual: `[번역 API 오류: ${res.status}]` };
          }
        } catch (error) {
          console.error(`Translation error for step ${i}:`, error);
          newSteps[i] = { ...newSteps[i], translatedManual: `[네트워크 오류]` };
        }
      }
    }
    
    setCookingSteps(newSteps);
    setIsTranslating(false);
  };

  // Preview manual in modal
  const handlePreviewManual = async (manual: SavedManual) => {
    try {
      const res = await fetch(`/api/manuals/${manual.id}?includeIngredients=true&includeCostVersions=true`);
      if (res.ok) {
        const fullManual = await res.json();
        setPreviewManual(fullManual);
        setShowPreviewModal(true);
      }
    } catch (error) {
      console.error('Failed to load manual:', error);
    }
  };

  // Edit manual - load into editor
  const handleEditManual = async (manual: SavedManual) => {
    try {
      const res = await fetch(`/api/manuals/${manual.id}?includeIngredients=true`);
      if (res.ok) {
        const fullManual = await res.json();
        // Load into editor
        setMenuName(fullManual.name || '');
        setMenuNameKo(fullManual.koreanName || '');
        setShelfLife(fullManual.shelfLife || '');
        setSellingPrice(fullManual.sellingPrice?.toString() || '');
        
        // Load image
        if (fullManual.imageUrl) {
          setMenuImageUrl(fullManual.imageUrl);
          // Extract filename from base64 or URL
          if (fullManual.imageUrl.startsWith('data:')) {
            setMenuImageName('첨부된 이미지');
          } else {
            setMenuImageName(fullManual.imageUrl.split('/').pop() || '이미지');
          }
        } else {
          setMenuImageUrl('');
          setMenuImageName('');
        }
        setMenuImage(null); // Reset file input
        
        // Load ingredients (simplified - no costVersions in Turso)
        if (fullManual.ingredients && fullManual.ingredients.length > 0) {
          setIngredients(fullManual.ingredients.map((ing: any, i: number) => {
            return {
              no: i + 1,
              name: ing.name || '',
              koreanName: ing.koreanName || '',
              weight: ing.quantity?.toString() || '',
              unit: ing.unit || 'g',
              purchase: ing.notes || 'Local',
              ingredientId: ing.ingredientId,
              price: null,
              currency: null
            };
          }));
        } else {
          setIngredients([{ ...EMPTY_INGREDIENT }]);
        }
        
        // Load cooking method - INITIALIZE FIRST
        setCookingSteps(DEFAULT_COOKING_PROCESSES.map(p => ({ process: p, manual: '', translatedManual: '' })));
        
        if (fullManual.cookingMethod) {
          const cookingData = typeof fullManual.cookingMethod === 'string' 
            ? JSON.parse(fullManual.cookingMethod) 
            : fullManual.cookingMethod;
          if (Array.isArray(cookingData) && cookingData.length > 0) {
            setCookingSteps(cookingData.map((step: any, index: number) => ({
              process: step.process || DEFAULT_COOKING_PROCESSES[index] || '',
              manual: step.manual || '',
              translatedManual: step.translatedManual || ''
            })));
          }
        }
        
        // Template ID - not available in Turso
        setEditorTemplateId('');
        
        setEditingManualId(manual.id);
        setActiveTab('editor');
      }
    } catch (error) {
      console.error('Failed to load manual for editing:', error);
    }
  };

  // Delete manual (Soft Delete)
  const handleDeleteManual = async (manual: SavedManual) => {
    if (!confirm(`"${manual.name}" 매뉴얼을 삭제하시겠습니까? 휴지통으로 이동됩니다.`)) return;
    
    try {
      const res = await fetch(`/api/manuals/${manual.id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('매뉴얼이 휴지통으로 이동되었습니다.');
        fetchData();
      } else {
        alert('삭제 실패');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // Restore manual
  const handleRestoreManual = async (manual: SavedManual) => {
    try {
      const res = await fetch(`/api/manuals/${manual.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true, isArchived: false })
      });
      
      if (res.ok) {
        alert('매뉴얼이 복구되었습니다.');
        fetchData();
      } else {
        alert('복구 실패');
      }
    } catch (error) {
      console.error('Restore error:', error);
      alert('복구 중 오류가 발생했습니다.');
    }
  };

  // Hard Delete (Archive)
  const handleHardDelete = async (manual: SavedManual) => {
    const input = prompt("완전 삭제하시려면 'TRASH'를 대문자로 입력하세요.\n이 작업 후에는 일반 사용자는 볼 수 없게 되며 마스터 계정에서만 복구 가능합니다.");
    if (input !== 'TRASH') return;

    try {
      const res = await fetch(`/api/manuals/${manual.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true, isActive: false })
      });
      
      if (res.ok) {
        alert('매뉴얼이 완전 삭제(보관) 처리되었습니다.');
        fetchData();
      } else {
        alert('삭제 실패');
      }
    } catch (error) {
      console.error('Hard delete error:', error);
      alert('완전 삭제 중 오류가 발생했습니다.');
    }
  };

  // Master Restore (From Archive to Trash)
  const handleMasterRestore = async (manual: SavedManual) => {
    if (!confirm('이 매뉴얼을 휴지통으로 복구하시겠습니까? (이후 일반 사용자가 휴지통에서 볼 수 있습니다)')) return;

    try {
      const res = await fetch(`/api/manuals/${manual.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: false, isActive: false }) // Move to Trash
      });
      
      if (res.ok) {
        alert('매뉴얼이 휴지통으로 복구되었습니다.');
        fetchData();
      } else {
        alert('복구 실패');
      }
    } catch (error) {
      console.error('Master restore error:', error);
      alert('마스터 복구 중 오류가 발생했습니다.');
    }
  };

  // Bulk Delete (Soft Delete)
  const handleBulkDelete = async () => {
    if (selectedManualIds.size === 0) return;
    if (!confirm(`${selectedManualIds.size}개 매뉴얼을 삭제하시겠습니까? 휴지통으로 이동됩니다.`)) return;

    try {
      const promises = Array.from(selectedManualIds).map(id => 
        fetch(`/api/manuals/${id}`, { method: 'DELETE' })
      );
      await Promise.all(promises);
      alert('선택한 매뉴얼이 휴지통으로 이동되었습니다.');
      setSelectedManualIds(new Set());
      fetchData();
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert('일괄 삭제 중 오류가 발생했습니다.');
    }
  };

  // Bulk Restore
  const handleBulkRestore = async () => {
    if (selectedManualIds.size === 0) return;
    if (!confirm(`${selectedManualIds.size}개 매뉴얼을 복구하시겠습니까?`)) return;

    try {
      const promises = Array.from(selectedManualIds).map(id => 
        fetch(`/api/manuals/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: true })
        })
      );
      await Promise.all(promises);
      alert('선택한 매뉴얼이 복구되었습니다.');
      setSelectedManualIds(new Set());
      fetchData();
    } catch (error) {
      console.error('Bulk restore error:', error);
      alert('일괄 복구 중 오류가 발생했습니다.');
    }
  };

  // Download Excel
  const handleDownloadExcel = async (manual: SavedManual) => {
    try {
      const response = await fetch(`/api/manuals/${manual.id}/export`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${manual.name.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_Manual.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        alert('Excel 다운로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('Excel download error:', error);
      alert('Excel 다운로드 중 오류가 발생했습니다.');
    }
  };

  // Clear editor form
  const clearEditorForm = () => {
    setMenuName('');
    setMenuNameKo('');
    setShelfLife('');
    setSellingPrice('');
    setIngredients([{ ...EMPTY_INGREDIENT }]);
    setCookingSteps(DEFAULT_COOKING_PROCESSES.map(p => ({ process: p, manual: '', translatedManual: '' })));
    setEditingManualId(null);
    setEditorTemplateId('');
    setMenuImage(null);
    setMenuImageName('');
    setMenuImageUrl('');
  };

  // Save manual (create new or update existing)
  const saveManual = async () => {
    console.log('📝 Save Manual called');
    console.log('   menuName:', JSON.stringify(menuName));
    console.log('   menuNameKo:', JSON.stringify(menuNameKo));
    
    const trimmedName = menuName?.trim() || '';
    const trimmedNameKo = menuNameKo?.trim() || '';
    
    if (!trimmedName && !trimmedNameKo) {
      alert('메뉴명을 입력해주세요. (한글 또는 영문 중 하나 이상)');
      return;
    }

    setIsSaving(true);
    try {
      // Convert image to base64 if a new file is selected
      let imageUrl = menuImageUrl;
      if (menuImage) {
        imageUrl = await fileToBase64(menuImage);
      }

      const payload = {
        name: trimmedName || trimmedNameKo,
        koreanName: trimmedNameKo,
        shelfLife,
        yield: 1, // 기본값 (생산량)
        yieldUnit: 'ea', // 기본 단위
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
        imageUrl, // 이미지 URL 추가
        cookingMethod: cookingSteps.filter(s => s.manual || s.translatedManual),
        ingredients: ingredients.filter(ing => ing.name || ing.koreanName).map(ing => ({
          ingredientId: ing.ingredientId,
          name: ing.name || ing.koreanName,
          koreanName: ing.koreanName,
          quantity: parseFloat(ing.weight) || 0,
          unit: ing.unit,
          section: 'MAIN',
          notes: ing.purchase
        }))
      };

      console.log('Sending payload:', JSON.stringify(payload, null, 2));

      let res;
      if (editingManualId) {
        // Update existing manual
        res = await fetch(`/api/manuals/${editingManualId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Create new manual
        res = await fetch('/api/manuals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        alert(editingManualId ? '매뉴얼이 수정되었습니다!' : '매뉴얼이 저장되었습니다!');
        
        // Reset form
        clearEditorForm();
        
        // Refresh data
        fetchData();
        setActiveTab('manuals');
      } else {
        // Extract error message from response
        console.error('Save failed with status:', res.status, res.statusText);
        let errorMessage = '알 수 없는 오류';
        let errorDetails = '';
        
        try {
          const errorData = await res.json();
          console.error('Error response data:', errorData);
          errorMessage = errorData.error || errorData.message || '서버 오류';
          errorDetails = errorData.details || errorData.hint || '';
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError);
          const textError = await res.text().catch(() => '응답 없음');
          console.error('Raw error response:', textError);
          errorDetails = textError.substring(0, 200);
        }
        
        const fullMessage = errorDetails 
          ? `저장 실패: ${errorMessage}\n\n상세: ${errorDetails}\n\n상태 코드: ${res.status}`
          : `저장 실패: ${errorMessage}\n\n상태 코드: ${res.status}`;
        
        console.error('Showing error to user:', fullMessage);
        alert(fullMessage);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // Create manual group - DISABLED (no ManualGroup in Turso)
  const createGroup = async () => {
    alert('그룹 기능은 현재 사용할 수 없습니다.');
  };

  // Apply template to group - DISABLED
  const applyTemplateToGroup = async (groupId: string, templateId: string) => {
    alert('템플릿 적용 기능은 현재 사용할 수 없습니다.');
  };

  // Apply template to selected manuals - DISABLED (no cost-versions in Turso)
  const applyTemplateToSelected = async () => {
    alert('템플릿 적용 기능은 현재 사용할 수 없습니다.');
  };

  // Toggle manual selection
  const toggleManualSelection = (manualId: string) => {
    setSelectedManualIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(manualId)) {
        newSet.delete(manualId);
      } else {
        newSet.add(manualId);
      }
      return newSet;
    });
  };

  // Select all manuals
  const toggleSelectAll = () => {
    const currentManuals = getGroupManuals();
    if (selectedManualIds.size === currentManuals.length) {
      setSelectedManualIds(new Set());
    } else {
      setSelectedManualIds(new Set(currentManuals.map(m => m.id)));
    }
  };

  // Get cost for a manual - DISABLED (no costVersions in Turso)
  const getManualCost = (manual: SavedManual): null => {
    // costVersions not available in Turso DB
    return null;
  };

  // Get applied template for a manual - DISABLED
  const getAppliedTemplate = (manual: SavedManual): null => {
    // Templates not linked to manuals in Turso DB
    return null;
  };

  // Calculate cost percentage - DISABLED
  const getCostPercentage = (manual: SavedManual): null => {
    // No cost data available
    return null;
  };

  // Get unique applied templates from all manuals (for dropdown) - DISABLED
  const getAppliedTemplates = (): { id: string; name: string; country?: string }[] => {
    // No templates available in Turso DB
    return [];
  };

  // Get manuals filtered by status (simplified)
  const getFilteredManuals = () => {
    let filtered = savedManuals;

    // Filter by Active/Trash tab using isArchived field
    if (activeTab === 'trash' || activeTab === 'archived') {
      // Show archived manuals
      filtered = filtered.filter(m => !!(m as any).isArchived);
    } else {
      // Show active (not archived) manuals
      filtered = filtered.filter(m => !(m as any).isArchived);
    }
    
    // Apply sorting (simplified - no cost/template data available)
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortField) {
          case 'name':
            aValue = a.name?.toLowerCase() || '';
            bValue = b.name?.toLowerCase() || '';
            break;
          case 'country':
            // Not available in Turso
            aValue = '';
            bValue = '';
            break;
          case 'cost':
            // Not available in Turso
            aValue = 0;
            bValue = 0;
            break;
          case 'sellingPrice':
            aValue = a.sellingPrice || 0;
            bValue = b.sellingPrice || 0;
            break;
          case 'costPct':
            // Not available in Turso
            aValue = 0;
            bValue = 0;
            break;
          default:
            return 0;
        }
        
        // Compare
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }
    
    return filtered;
  };

  // Get manuals for selected group (legacy, now uses getFilteredManuals)
  const getGroupManuals = () => {
    return getFilteredManuals();
  };
  
  // Handle column header click for sorting
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Render sort icon
  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 inline ml-1" />
      : <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Menu Manual Templates</h1>
          <p className="text-slate-500 mt-1">
            {editingManualId ? (
              <span className="text-orange-600 font-medium">수정 중: {menuName || menuNameKo}</span>
            ) : (
              'Create and manage kitchen manuals with cost calculation'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'editor' && (
            <>
              {editingManualId && (
                <button
                  onClick={clearEditorForm}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <X className="w-4 h-4 mr-2" />
                  수정 취소
                </button>
              )}
              <button
                onClick={saveManual}
                disabled={isSaving}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : editingManualId ? 'Update Manual' : 'Save Manual'}
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <Eye className="w-4 h-4 mr-2" />
                {showPreview ? 'Edit' : 'Preview'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 print:hidden">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'editor' 
                ? 'border-orange-500 text-orange-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Manual Editor
          </button>
          <button
            onClick={() => setActiveTab('manuals')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'manuals' 
                ? 'border-orange-500 text-orange-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Saved Manuals ({savedManuals.filter(m => !(m as any).isDeleted).length})
          </button>
          <button
            onClick={() => setActiveTab('costTable')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'costTable' 
                ? 'border-orange-500 text-orange-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Table className="w-4 h-4 inline mr-2" />
            Cost Table
          </button>
          <button
            onClick={() => setActiveTab('trash')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'trash' 
                ? 'border-red-500 text-red-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Trash2 className="w-4 h-4 inline mr-2" />
            Trash ({savedManuals.filter(m => !!(m as any).isDeleted).length})
          </button>
          {isMaster && (
            <button
              onClick={() => setActiveTab('archived')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'archived' 
                  ? 'border-purple-500 text-purple-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Archive className="w-4 h-4 inline mr-2" />
              Archived ({savedManuals.filter(m => !!(m as any).isDeleted).length})
            </button>
          )}
        </nav>
      </div>

      {/* Editor Tab */}
      {activeTab === 'editor' && !showPreview && (
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-orange-500" />
              Basic Information
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메뉴명 (한글)</label>
                <input
                  type="text"
                  value={menuNameKo}
                  onChange={(e) => setMenuNameKo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="크리미어니언치킨"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Menu Name (English)</label>
                <input
                  type="text"
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Creamy Onion Chicken"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">판매가 (Selling Price)</label>
                <input
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">가격 템플릿 (Price Template)</label>
                <select
                  value={editorTemplateId}
                  onChange={(e) => setEditorTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">템플릿 선택...</option>
                  {priceTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.country || 'N/A'})</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Menu Image Upload */}
            <div className="mt-4 pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-1">메뉴 사진 (Menu Photo)</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center px-4 py-2 bg-gray-100 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-200 transition-colors">
                  <Upload className="w-4 h-4 mr-2 text-gray-600" />
                  <span className="text-sm text-gray-700">사진 첨부</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setMenuImage(file);
                        setMenuImageName(file.name);
                        // Create preview URL
                        const base64 = await fileToBase64(file);
                        setMenuImageUrl(base64);
                      }
                    }}
                  />
                </label>
                {menuImageName && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-md">
                    <Image className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-orange-700">{menuImageName}</span>
                    <button
                      onClick={() => {
                        setMenuImage(null);
                        setMenuImageName('');
                        setMenuImageUrl('');
                      }}
                      className="text-orange-400 hover:text-orange-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              {/* Image Preview */}
              {menuImageUrl && (
                <div className="mt-3 p-2 border border-gray-200 rounded-lg bg-gray-50 inline-block">
                  <img 
                    src={menuImageUrl} 
                    alt="메뉴 사진 미리보기" 
                    className="max-h-40 max-w-xs object-contain rounded"
                  />
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">지원 형식: JPG, PNG, GIF (최대 5MB)</p>
            </div>
          </div>

          {/* Main Ingredients */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Main Ingredients</h3>
              <button onClick={addIngredient} className="flex items-center text-sm text-orange-600 hover:text-orange-700">
                <Plus className="w-4 h-4 mr-1" /> Add Ingredient
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left w-10">No.</th>
                    <th className="px-2 py-2 text-left">Ingredient Name</th>
                    <th className="px-2 py-2 text-left w-20">Weight</th>
                    <th className="px-2 py-2 text-left w-16">Unit</th>
                    <th className="px-2 py-2 text-left w-24">Purchase</th>
                    {editorTemplateId && <th className="px-2 py-2 text-right w-24">Price</th>}
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1 text-gray-500">{ing.no}</td>
                      <td className="px-2 py-1 relative">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 relative">
                            <input 
                              type="text" 
                              value={ing.koreanName || ing.name} 
                              onChange={(e) => handleIngredientInput(i, e.target.value)}
                              onFocus={() => setActiveIngredientIndex(i)}
                              onBlur={() => setTimeout(() => setActiveIngredientIndex(null), 200)}
                              className="w-full px-2 py-1 border rounded" 
                              placeholder="재료명 입력 (한글 가능)" 
                            />
                            {activeIngredientIndex === i && suggestions.length > 0 && (
                              <div className="absolute z-20 left-0 right-0 top-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                                {suggestions.map((sugg) => (
                                  <div 
                                    key={sugg.id} 
                                    className="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm"
                                    onClick={() => selectIngredient(i, sugg)}
                                  >
                                    <div className="flex justify-between items-center">
                                      <span>{sugg.koreanName} → {sugg.englishName}</span>
                                      <div className="flex items-center gap-2">
                                        {sugg.price ? (
                                          <span className="text-green-600 font-medium">${sugg.price.toFixed(2)}</span>
                                        ) : (
                                          <span className="text-gray-400 text-xs">가격 없음</span>
                                        )}
                                        <span className="text-gray-400 text-xs">{sugg.category}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {ing.ingredientId && (
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                              ✓ 연결됨
                            </span>
                          )}
                        </div>
                        {ing.name && ing.name !== ing.koreanName && (
                          <span className="text-xs text-green-600">→ {ing.name}</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <input 
                          type="text" 
                          value={ing.weight} 
                          onChange={(e) => updateIngredient(i, 'weight', e.target.value)} 
                          className="w-full px-2 py-1 border rounded" 
                          placeholder="100" 
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select 
                          value={ing.unit} 
                          onChange={(e) => updateIngredient(i, 'unit', e.target.value)} 
                          className="w-full px-2 py-1 border rounded"
                        >
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                          <option value="ml">ml</option>
                          <option value="L">L</option>
                          <option value="oz">oz</option>
                          <option value="ea">ea</option>
                          <option value="pcs">pcs</option>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select 
                          value={ing.purchase} 
                          onChange={(e) => updateIngredient(i, 'purchase', e.target.value)} 
                          className="w-full px-2 py-1 border rounded"
                        >
                          <option value="Local">Local</option>
                          <option value="HQ">HQ</option>
                          <option value="Prep">Prep</option>
                          <option value="Costco">Costco</option>
                        </select>
                      </td>
                      {editorTemplateId && (
                        <td className="px-2 py-1 text-right">
                          {ing.price ? (
                            <span className="text-green-600 font-medium">${ing.price.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-2 py-1">
                        <button onClick={() => removeIngredient(i)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cooking Method */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Cooking Method</h3>
                <p className="text-sm text-gray-500">한글로 입력하면 AI가 영문으로 번역합니다.</p>
              </div>
              <button
                onClick={translateAllCookingMethods}
                disabled={isTranslating}
                className="flex items-center px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isTranslating ? 'animate-spin' : ''}`} />
                {isTranslating ? 'Translating...' : 'Translate All'}
              </button>
            </div>
            <div className="space-y-4">
              {cookingSteps.map((step, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 items-start">
                  <div className="bg-gray-100 px-3 py-2 rounded font-medium text-sm">{step.process}</div>
                  <div className="col-span-3 space-y-2">
                    <textarea
                      value={step.manual}
                      onChange={(e) => updateCookingStep(i, e.target.value)}
                      onBlur={() => step.manual && translateCookingMethod(i)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[60px]"
                      placeholder={`${step.process.toLowerCase()} 지침 입력 (한글 가능)...`}
                    />
                    {step.translatedManual && (
                      <div className="bg-green-50 border border-green-200 rounded p-2 text-sm text-green-800">
                        <span className="font-medium">EN: </span>{step.translatedManual}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Saved Manuals, Trash & Archived Tab */}
      {(activeTab === 'manuals' || activeTab === 'trash' || activeTab === 'archived') && (
        <div className="space-y-4">
          {/* Controls Row */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-end gap-4">
              {/* Left: Info */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">메뉴얼 목록</label>
                <p className="text-sm text-gray-500">총 {savedManuals.filter(m => !(m as any).isArchived).length}개 매뉴얼</p>
              </div>

              {/* Right: Actions */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {selectedManualIds.size > 0 ? (
                    <span className="text-blue-600 font-semibold">{selectedManualIds.size}개 선택됨</span>
                  ) : (
                    '선택 작업'
                  )}
                </label>
                <div className="flex gap-2 justify-end">
                  {activeTab === 'manuals' && (
                    <>
                      <button
                        onClick={handleBulkDelete}
                        disabled={selectedManualIds.size === 0}
                        className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm flex items-center"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> 삭제
                      </button>
                    </>
                  )}
                  {activeTab === 'trash' && (
                    <button
                      onClick={handleBulkRestore}
                      disabled={selectedManualIds.size === 0}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" /> 선택 복구
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Manuals List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={selectedManualIds.size > 0 && selectedManualIds.size === getGroupManuals().length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                  </th>
                  <th onClick={() => handleSort('name')} className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100">
                    메뉴명 <SortIcon field="name" />
                  </th>
                  <th onClick={() => handleSort('sellingPrice')} className="px-4 py-3 text-right text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100">
                    판매가 (Selling Price) <SortIcon field="sellingPrice" />
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    Shelf Life
                  </th>
                  {activeTab === 'trash' && (
                    <>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">삭제 정보</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getGroupManuals().map((manual) => {
                  return (
                    <tr key={manual.id} className={`hover:bg-gray-50 ${selectedManualIds.has(manual.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedManualIds.has(manual.id)}
                          onChange={() => toggleManualSelection(manual.id)}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{manual.name}</div>
                          {manual.koreanName && manual.koreanName !== manual.name && (
                            <div className="text-sm text-gray-500">{manual.koreanName}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {manual.sellingPrice ? (
                          <span className="font-medium">${manual.sellingPrice.toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-600">{manual.shelfLife || '-'}</span>
                      </td>
                      {activeTab === 'trash' && (
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <div>{(manual as any).deletedBy || 'Unknown'}</div>
                          <div className="text-xs text-gray-400">
                            {(manual as any).deletedAt ? new Date((manual as any).deletedAt).toLocaleDateString() : '-'}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          {activeTab !== 'archived' && (
                            <button 
                              onClick={() => handlePreviewManual(manual)}
                              className="p-1 text-gray-400 hover:text-blue-500" 
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          {activeTab === 'manuals' && (
                            <>
                              <button 
                                onClick={() => handleDownloadExcel(manual)}
                                className="p-1 text-gray-400 hover:text-green-500" 
                                title="Excel"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleEditManual(manual)}
                                className="p-1 text-gray-400 hover:text-orange-500" 
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteManual(manual)}
                                className="p-1 text-gray-400 hover:text-red-500" 
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {activeTab === 'trash' && (
                            <>
                              <button 
                                onClick={() => handleRestoreManual(manual)}
                                className="p-1 text-gray-400 hover:text-blue-500" 
                                title="Restore"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleHardDelete(manual)}
                                className="p-1 text-gray-400 hover:text-red-700 bg-red-50 rounded" 
                                title="Hard Delete"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </>
                          )}
                          {activeTab === 'archived' && (
                            <button 
                              onClick={() => handleMasterRestore(manual)}
                              className="p-1 text-gray-400 hover:text-purple-500" 
                              title="Restore to Trash"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {getGroupManuals().length === 0 && (
                  <tr>
                    <td colSpan={activeTab === 'trash' ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                      {activeTab === 'manuals' 
                        ? '저장된 매뉴얼이 없습니다. Manual Editor에서 새 매뉴얼을 작성하세요.'
                        : activeTab === 'trash'
                        ? '휴지통이 비어있습니다.'
                        : '완전 삭제된 매뉴얼이 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cost Table Tab */}
      {activeTab === 'costTable' && (
        <div className="space-y-4">
          {/* Cost Table Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">원가표 (Cost Table)</h2>
              <p className="text-sm text-gray-500">저장된 매뉴얼의 원가를 계산합니다</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Price Template:</span>
              <select
                value={editorTemplateId}
                onChange={(e) => setEditorTemplateId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Select Template</option>
                {priceTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.currency || 'CAD'})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cost Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">메뉴명</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Menu Name</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">식재료 수</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">원가</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">판매가</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">원가율</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">마진</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {savedManuals.filter(m => !m.isDeleted && !m.isArchived).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      저장된 매뉴얼이 없습니다. Editor 탭에서 매뉴얼을 먼저 작성해주세요.
                    </td>
                  </tr>
                ) : (
                  savedManuals.filter(m => !m.isDeleted && !m.isArchived).map(manual => {
                    // Calculate cost from ingredients (simplified - actual calc would need template prices)
                    const ingredientCount = manual.ingredients?.length || 0;
                    const totalCost = manual.ingredients?.reduce((sum: number, ing: any) => {
                      const qty = ing.quantity || 0;
                      const price = ing.unitPrice || 0;
                      return sum + (qty * price);
                    }, 0) || 0;
                    const sellingPrice = manual.sellingPrice || 0;
                    const costRate = sellingPrice > 0 ? ((totalCost / sellingPrice) * 100).toFixed(1) : '-';
                    const margin = sellingPrice > 0 ? (sellingPrice - totalCost).toFixed(2) : '-';
                    
                    return (
                      <tr key={manual.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handlePreviewManual(manual)}>
                        <td className="px-4 py-3 font-medium">{manual.koreanName || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{manual.name}</td>
                        <td className="px-4 py-3 text-center">{ingredientCount}</td>
                        <td className="px-4 py-3 text-right font-mono">${totalCost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono">${sellingPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`${parseFloat(costRate as string) > 35 ? 'text-red-600' : 'text-green-600'}`}>
                            {costRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-green-600">${margin}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              <strong>원가 계산 방법:</strong> 각 식재료의 사용량 × 단가의 합계로 계산됩니다.<br/>
              정확한 원가 계산을 위해 Pricing 메뉴에서 가격 템플릿을 설정하고, 매뉴얼 작성 시 템플릿을 선택해주세요.
            </p>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewManual && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">매뉴얼 미리보기</h2>
              <button 
                onClick={() => { setShowPreviewModal(false); setPreviewManual(null); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="border-2 border-black">
                <div className="bg-yellow-300 p-3 border-b-2 border-black text-center">
                  <h2 className="text-xl font-bold">Manual (Kitchen)</h2>
                </div>
                <div className="grid grid-cols-6 border-b-2 border-black">
                  <div className="col-span-1 bg-gray-200 p-2 border-r border-black font-bold">Name</div>
                  <div className="col-span-5 p-2 font-bold text-lg">{previewManual.name}</div>
                </div>
                {previewManual.koreanName && (
                  <div className="grid grid-cols-6 border-b border-black">
                    <div className="col-span-1 bg-gray-200 p-2 border-r border-black font-bold">한글명</div>
                    <div className="col-span-5 p-2">{previewManual.koreanName}</div>
                  </div>
                )}
                {/* Menu Image */}
                {(previewManual as any).imageUrl && (
                  <div className="grid grid-cols-6 border-b border-black">
                    <div className="col-span-1 bg-gray-200 p-2 border-r border-black font-bold">사진</div>
                    <div className="col-span-5 p-2 flex justify-center">
                      <img 
                        src={(previewManual as any).imageUrl} 
                        alt={previewManual.name}
                        className="max-h-48 object-contain rounded"
                      />
                    </div>
                  </div>
                )}
                {previewManual.shelfLife && (
                  <div className="grid grid-cols-6 border-b border-black">
                    <div className="col-span-1 bg-gray-200 p-2 border-r border-black font-bold">Shelf Life</div>
                    <div className="col-span-5 p-2">{previewManual.shelfLife}</div>
                  </div>
                )}
                {/* Ingredients */}
                {previewManual.ingredients && previewManual.ingredients.length > 0 && (
                  <div className="border-b-2 border-black">
                    <div className="bg-gray-200 p-2 font-bold border-b border-black">Ingredients Composition</div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border-r border-b border-black p-1 w-10">No.</th>
                          <th className="border-r border-b border-black p-1">Ingredients</th>
                          <th className="border-r border-b border-black p-1 w-16">Qty</th>
                          <th className="border-r border-b border-black p-1 w-12">Unit</th>
                          <th className="border-b border-black p-1 w-20">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewManual.ingredients.map((ing: any, i: number) => (
                          <tr key={i}>
                            <td className="border-r border-b border-black p-1 text-center">{i + 1}</td>
                            <td className="border-r border-b border-black p-1">{ing.name || ing.koreanName}</td>
                            <td className="border-r border-b border-black p-1 text-center">{ing.quantity}</td>
                            <td className="border-r border-b border-black p-1 text-center">{ing.unit}</td>
                            <td className="border-b border-black p-1 text-center">{ing.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Cooking Method */}
                {(previewManual as any).cookingMethod && (
                  <div>
                    <div className="bg-gray-200 p-2 font-bold border-b border-black text-center">COOKING METHOD</div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border-r border-b border-black p-2 w-40">PROCESS</th>
                          <th className="border-b border-black p-2">MANUAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const cookingData = typeof (previewManual as any).cookingMethod === 'string' 
                            ? JSON.parse((previewManual as any).cookingMethod) 
                            : (previewManual as any).cookingMethod;
                          return Array.isArray(cookingData) ? cookingData.filter((s: any) => s.manual || s.translatedManual).map((step: any, i: number) => (
                            <tr key={i}>
                              <td className="border-r border-b border-black p-2 bg-gray-50 font-medium">{step.process}</td>
                              <td className="border-b border-black p-2 whitespace-pre-wrap">{step.translatedManual || step.manual}</td>
                            </tr>
                          )) : null;
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t px-6 py-4 flex justify-end gap-2">
              <button
                onClick={() => handleDownloadExcel(previewManual)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                <Download className="w-4 h-4 inline mr-2" />
                Excel 다운로드
              </button>
              <button
                onClick={() => { setShowPreviewModal(false); handleEditManual(previewManual); }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                <Edit className="w-4 h-4 inline mr-2" />
                수정하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
