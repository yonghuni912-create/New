'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { FileText, Download, Plus, Trash2, Eye, Save, RefreshCw, Settings, Table, Search, X, Edit, ChevronDown, ChevronLeft, ChevronRight, Upload, Image, ChevronUp, Archive, History, Globe, Copy, Check, CheckCheck } from 'lucide-react';
import * as XLSX from 'xlsx';

// 타입 정의
interface IngredientSuggestion {
  id: string;
  koreanName: string;
  englishName: string;
  category: string;
  quantity?: number;
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
  baseQuantity?: number | null; // pricing 기준 수량 (원가 계산용)
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
  isMaster?: boolean;
}

const DEFAULT_COOKING_PROCESSES = [
  'Ingredients Preparation',
  'Thawing',
  'Marination',
  'Batter Mix Solution Preparation',
  'Battering',
  'Breading',
  'Frying',
  'Grilling',
  'Boiling',
  'Steaming',
  'Sautéing',
  'Baking',
  'Sauce Preparation',
  'Seasoning',
  'Mixing',
  'Cutting',
  'Plating',
  'Assemble',
  'Garnish',
  'Serve',
  'Take Out & Delivery',
  'Custom'
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
  const [activeTab, setActiveTab] = useState<'editor' | 'manuals' | 'countryManuals' | 'costTable' | 'trash' | 'archived'>('editor');
  
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
  const [cloneTemplateId, setCloneTemplateId] = useState<string>(''); // 복제 대상 국가 템플릿
  const [isCloning, setIsCloning] = useState(false);
  const [countryFilterTemplateId, setCountryFilterTemplateId] = useState<string>(''); // 국가별 매뉴얼 필터
  
  // Sorting state for manuals table
  const [sortField, setSortField] = useState<'name' | 'country' | 'cost' | 'sellingPrice' | 'costPct' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Editor template selection
  const [editorTemplateId, setEditorTemplateId] = useState<string>('');
  
  // Image upload state
  const [menuImage, setMenuImage] = useState<File | null>(null);
  const [menuImageName, setMenuImageName] = useState<string>('');
  const [menuImageUrl, setMenuImageUrl] = useState<string>(''); // Base64 또는 URL

  // Excel upload state
  const [showExcelUploadModal, setShowExcelUploadModal] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelPreviewData, setExcelPreviewData] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [excelPreviewIndex, setExcelPreviewIndex] = useState(0); // Current manual index in preview
  const [excelConfirmedManuals, setExcelConfirmedManuals] = useState<Set<number>>(new Set()); // Confirmed manual indices
  
  // Chunk upload state
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number; saved: number } | null>(null);
  const [pendingManuals, setPendingManuals] = useState<any[]>([]);

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

  // Ingredient search - now filters by selected template
  const searchIngredients = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      return;
    }

    try {
      // If a template is selected, search within template items
      if (editorTemplateId) {
        const res = await fetch(`/api/price-templates/${editorTemplateId}/items`);
        if (res.ok) {
          const items = await res.json();
          const lowerQuery = query.toLowerCase();
          
          // Filter template items by search query and map to suggestion format
          const filtered = items
            .filter((item: any) => 
              (item.koreanName?.toLowerCase().includes(lowerQuery)) ||
              (item.englishName?.toLowerCase().includes(lowerQuery)) ||
              (item.localEnglishName?.toLowerCase().includes(lowerQuery)) ||
              (item.localKoreanName?.toLowerCase().includes(lowerQuery))
            )
            .slice(0, 8)
            .map((item: any) => ({
              id: item.ingredientMasterId,
              koreanName: item.localKoreanName || item.koreanName,
              englishName: item.localEnglishName || item.englishName,
              category: item.category,
              quantity: item.localQuantity ?? item.quantity,
              unit: item.localUnit || item.unit,
              yieldRate: item.localYieldRate ?? item.yieldRate,
              // Include price from template item (mapped to 'price' for UI)
              price: item.unitPrice,
              currency: 'CAD',
            }));
          
          setSuggestions(filtered);
          return;
        }
      }
      
      // Fallback to master ingredients search
      const url = `/api/ingredients/search?q=${encodeURIComponent(query)}&limit=8`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }, [editorTemplateId]);

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
    // Get price and local values from selected template
    let price = (suggestion as any).unitPrice || 0;
    let currency = 'CAD';
    let englishName = suggestion.englishName;
    let unit = suggestion.unit;
    let quantity = suggestion.quantity;
    let baseQuantity = suggestion.quantity; // pricing 기준 수량
    
    if (editorTemplateId) {
      try {
        const res = await fetch(`/api/price-templates/${editorTemplateId}/items`);
        if (res.ok) {
          const items = await res.json();
          const item = items.find((i: any) => i.ingredientMasterId === suggestion.id);
          if (item) {
            price = item.unitPrice;
            // Use local values if they exist
            englishName = item.localEnglishName || item.englishName || suggestion.englishName;
            unit = item.localUnit || item.unit || suggestion.unit;
            // baseQuantity는 pricing 아이템의 기준 수량
            baseQuantity = item.localQuantity ?? item.quantity ?? suggestion.quantity;
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
      name: englishName,
      koreanName: suggestion.koreanName,
      unit: unit,
      weight: quantity ? String(quantity) : newIngredients[index].weight,
      ingredientId: suggestion.id,
      price: price,
      currency: currency,
      baseQuantity: baseQuantity // pricing 기준 수량 저장
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
        
        // Load price template ID
        setEditorTemplateId(fullManual.priceTemplateId || '');
        
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
        const errorData = await res.json().catch(() => ({}));
        console.error('Restore failed:', res.status, errorData);
        alert(`복구 실패: ${errorData.error || errorData.details || res.statusText}`);
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
      const response = await fetch(`/api/manuals/${manual.id}/excel`);
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
        priceTemplateId: editorTemplateId || null, // 가격 템플릿 ID
        cookingMethod: cookingSteps.filter(s => s.manual || s.translatedManual),
        ingredients: ingredients.filter(ing => ing.name || ing.koreanName).map(ing => ({
          ingredientId: ing.ingredientId,
          name: ing.name || ing.koreanName,
          koreanName: ing.koreanName,
          quantity: parseFloat(ing.weight) || 0,
          unit: ing.unit,
          section: 'MAIN',
          notes: ing.purchase,
          unitPrice: ing.price || null,      // pricing 가격
          baseQuantity: ing.baseQuantity || null  // pricing 기준 수량
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

  // Clone selected master manuals to a country template
  const cloneToCountryTemplate = async () => {
    if (selectedManualIds.size === 0) {
      alert('복제할 매뉴얼을 선택해주세요.');
      return;
    }
    if (!cloneTemplateId) {
      alert('복제할 국가 템플릿을 선택해주세요.');
      return;
    }

    setIsCloning(true);
    try {
      const res = await fetch('/api/manuals/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualIds: Array.from(selectedManualIds),
          priceTemplateId: cloneTemplateId
        })
      });

      if (res.ok) {
        const result = await res.json();
        const template = priceTemplates.find(t => t.id === cloneTemplateId);
        alert(`${result.clonedCount}개의 매뉴얼이 ${template?.country || '선택한 국가'}에 복제되었습니다.`);
        setSelectedManualIds(new Set());
        setCloneTemplateId('');
        fetchData();
      } else {
        const error = await res.json();
        alert(`복제 실패: ${error.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('Clone error:', error);
      alert('복제 중 오류가 발생했습니다.');
    } finally {
      setIsCloning(false);
    }
  };

  // Client-side Excel parsing function - BBQ Chicken Format
  const parseManualSheet = (sheet: XLSX.WorkSheet, sheetName: string): any | null => {
    // Convert sheet to JSON array of arrays for easier processing
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (data.length < 5) return null;
    
    // Skip non-menu sheets
    const sheetLower = sheetName.toLowerCase();
    if (sheetLower === ' kitchen manual' ||
        sheetLower === 'kitchen manual' ||
        sheetLower.includes('contents') || 
        sheetLower.includes('목차') ||
        sheetLower.includes('index') ||
        sheetLower.includes('summary')) {
      return null;
    }
    
    // Helper function to get cell value
    const getCellValue = (row: number, col: number): string => {
      if (row < 0 || row >= data.length) return '';
      const rowData = data[row] || [];
      if (col < 0 || col >= rowData.length) return '';
      return String(rowData[col] ?? '').trim();
    };
    
    // Helper function to find row containing keyword
    const findRowWithKeyword = (keyword: string, startRow = 0): number => {
      for (let r = startRow; r < Math.min(data.length, 50); r++) {
        const row = data[r] || [];
        for (let c = 0; c < row.length; c++) {
          if (String(row[c] ?? '').toLowerCase().includes(keyword.toLowerCase())) {
            return r;
          }
        }
      }
      return -1;
    };
    
    let name = '';
    let koreanName = '';
    let sellingPrice: number | undefined;
    let shelfLife: string | undefined;
    const ingredients: any[] = [];
    const cookingMethod: any[] = [];
    
    // 1. Find "Name" in row 1 or nearby - value is in next column
    const nameRow = findRowWithKeyword('Name');
    if (nameRow >= 0) {
      const row = data[nameRow] || [];
      for (let c = 0; c < row.length; c++) {
        if (String(row[c] ?? '').toLowerCase() === 'name') {
          const nameValue = String(row[c + 1] ?? '').trim();
          if (nameValue) name = nameValue;
          break;
        }
      }
    }
    
    // Fallback to sheet name if no name found
    if (!name) name = sheetName.replace(/^\d+\./, '').trim();
    
    // 2. Find Korean name (한글명 or 한글)
    const koreanRow = findRowWithKeyword('한글');
    if (koreanRow >= 0) {
      const row = data[koreanRow] || [];
      for (let c = 0; c < row.length; c++) {
        if (String(row[c] ?? '').includes('한글')) {
          const kValue = String(row[c + 1] ?? '').trim();
          if (kValue) koreanName = kValue;
          break;
        }
      }
    }
    if (!koreanName) koreanName = name;
    
    // 3. Find price (판매가 or price)
    const priceRow = findRowWithKeyword('price');
    if (priceRow < 0) {
      const priceRowKr = findRowWithKeyword('판매가');
      if (priceRowKr >= 0) {
        const row = data[priceRowKr] || [];
        for (let c = 0; c < row.length; c++) {
          if (String(row[c] ?? '').includes('판매가')) {
            const priceVal = parseFloat(String(row[c + 1] ?? '').replace(/[^0-9.]/g, ''));
            if (!isNaN(priceVal)) sellingPrice = priceVal;
            break;
          }
        }
      }
    }
    
    // 4. Find and parse Ingredients section
    // Look for row with "Ingredients Composition" or header row with NO/Ingredients/Weight
    const ingredientHeaderRow = findRowWithKeyword('Ingredients Composition');
    let headerRow = -1;
    let colNo = -1, colName = -1, colWeight = -1, colUnit = -1, colPurchase = -1, colOthers = -1;
    
    // Find the actual header row (NO, Ingredients, Weight, Unit)
    const searchStart = ingredientHeaderRow >= 0 ? ingredientHeaderRow : 0;
    for (let r = searchStart; r < Math.min(searchStart + 5, data.length); r++) {
      const row = data[r] || [];
      const rowText = row.map(c => String(c ?? '').toLowerCase()).join(' ');
      
      // Look for row that has NO and Weight or Unit
      if ((rowText.includes('no') || rowText.includes('no.')) && 
          (rowText.includes('weight') || rowText.includes('unit') || rowText.includes('ingredients'))) {
        headerRow = r;
        
        // Map column positions from header
        for (let c = 0; c < row.length; c++) {
          const cellText = String(row[c] ?? '').toLowerCase().trim();
          if (cellText === 'no' || cellText === 'no.') colNo = c;
          else if (cellText === 'ingredients' || cellText === 'ingredient') colName = c;
          else if (cellText === 'weight' || cellText === 'qty') colWeight = c;
          else if (cellText === 'unit') colUnit = c;
          else if (cellText === 'purchase') colPurchase = c;
          else if (cellText === 'others') colOthers = c;
        }
        break;
      }
    }
    
    // Parse ingredient rows
    if (headerRow >= 0) {
      for (let r = headerRow + 1; r < Math.min(data.length, headerRow + 50); r++) {
        const row = data[r] || [];
        
        // Stop at cooking method section
        const firstCell = String(row[0] ?? '').toLowerCase();
        if (firstCell.includes('cooking') || firstCell.includes('method') || 
            firstCell.includes('process') || firstCell.includes('조리')) {
          break;
        }
        
        // Get ingredient name - try detected column, then fallback to column 2
        let ingredientName = '';
        if (colName >= 0 && row[colName]) {
          ingredientName = String(row[colName]).trim();
        } else if (row[2]) {
          ingredientName = String(row[2]).trim();
        }
        
        // Skip empty rows, totals, or notes
        if (!ingredientName || 
            ingredientName.toLowerCase().includes('total') || 
            ingredientName.toLowerCase().includes('합계') ||
            ingredientName.startsWith('*') ||
            ingredientName.toLowerCase() === 'ingredients') {
          continue;
        }
        
        // Parse weight - find first numeric value after name
        let weight = 0;
        let unit = 'g';
        let purchase = 'Local';
        let others = '';
        
        // Strategy: scan row for numeric weight and text unit
        // Weight should be a number, Unit should be g/ml/ea/pcs/etc
        for (let c = colName >= 0 ? colName + 1 : 3; c < row.length; c++) {
          const cellValue = row[c];
          if (cellValue === null || cellValue === undefined) continue;
          
          // Check if it's a number (weight)
          if (typeof cellValue === 'number') {
            if (weight === 0) weight = cellValue;
            continue;
          }
          
          const cellText = String(cellValue).trim().toLowerCase();
          if (!cellText) continue;
          
          // Check if it's a unit
          if (['g', 'ml', 'ea', 'pcs', 'piece', 'pieces', 'oz', 'kg', 'l', 'tbsp', 'tsp', 'cup'].includes(cellText)) {
            unit = cellText;
          }
          // Check if it looks like a number string
          else if (/^[\d.]+$/.test(cellText) && weight === 0) {
            weight = parseFloat(cellText);
          }
          // Check for purchase origin
          else if (['local', 'korea', 'import'].includes(cellText)) {
            purchase = cellText.charAt(0).toUpperCase() + cellText.slice(1);
          }
          // Otherwise it might be notes/others
          else if (cellText.length > 0 && cellText !== 'null') {
            if (!others) others = String(cellValue).trim();
          }
        }
        
        // Also try specific columns if detected
        if (colWeight >= 0 && row[colWeight] !== undefined && row[colWeight] !== null) {
          const wVal = parseFloat(String(row[colWeight]).replace(/[^0-9.]/g, ''));
          if (!isNaN(wVal) && wVal > 0) weight = wVal;
        }
        if (colUnit >= 0 && row[colUnit]) {
          const uVal = String(row[colUnit]).trim();
          if (uVal && !['null', 'undefined'].includes(uVal.toLowerCase())) unit = uVal;
        }
        if (colPurchase >= 0 && row[colPurchase]) {
          purchase = String(row[colPurchase]).trim();
        }
        if (colOthers >= 0 && row[colOthers]) {
          others = String(row[colOthers]).trim();
        }
        
        ingredients.push({
          name: ingredientName,
          koreanName: ingredientName,
          quantity: weight,
          unit: unit.toLowerCase() === 'null' ? 'g' : unit,
          purchase: purchase || 'Local',
          notes: others || ''
        });
      }
    }
    
    // 5. Find and parse COOKING METHOD section
    const cookingRow = findRowWithKeyword('COOKING METHOD');
    if (cookingRow >= 0) {
      let processCol = 0, manualCol = -1;
      
      // Find header row for cooking method
      for (let r = cookingRow; r < Math.min(cookingRow + 3, data.length); r++) {
        const row = data[r] || [];
        for (let c = 0; c < row.length; c++) {
          const cellText = String(row[c] ?? '').toLowerCase();
          if (cellText === 'process') processCol = c;
          if (cellText === 'manual') manualCol = c;
        }
        if (manualCol >= 0) {
          // Parse cooking steps starting from next row
          for (let sr = r + 1; sr < Math.min(data.length, r + 30); sr++) {
            const stepRow = data[sr] || [];
            const firstCell = String(stepRow[0] ?? '').toLowerCase();
            
            // Stop at tips/notes/signature section
            if (firstCell.includes('tip') || firstCell.includes('note') || 
                firstCell.includes('서명') || firstCell.includes('signature')) {
              break;
            }
            
            const process = String(stepRow[processCol] ?? '').trim();
            const manual = String(stepRow[manualCol] ?? stepRow[manualCol + 1] ?? '').trim();
            
            if (process && manual && manual.length > 3) {
              cookingMethod.push({
                process,
                manual,
                translatedManual: ''
              });
            }
          }
          break;
        }
      }
    }
    
    // Skip if no valid content
    if (!name && ingredients.length === 0 && cookingMethod.length === 0) {
      return null;
    }
    
    console.log(`📋 Parsed sheet "${sheetName}": name="${name}", ${ingredients.length} ingredients, ${cookingMethod.length} steps`);
    
    return {
      name: name || sheetName,
      koreanName: koreanName || name || sheetName,
      sellingPrice,
      shelfLife,
      ingredients,
      cookingMethod,
      hasLinkingIssue: false
    };
  };

  // Excel file upload - client-side parsing for large files
  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`📂 Selected file: ${file.name} (${fileSizeMB.toFixed(1)}MB)`);
    
    setExcelFile(file);
    setIsUploading(true);
    
    try {
      // Always parse client-side for reliability
      console.log('📊 Parsing Excel client-side...');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      console.log(`📋 Found ${workbook.SheetNames.length} sheets`);
      
      const allManuals: any[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const manual = parseManualSheet(sheet, sheetName);
        if (manual) {
          allManuals.push(manual);
        }
      }
      
      console.log(`✅ Parsed ${allManuals.length} manuals from ${workbook.SheetNames.length} sheets`);
      
      if (allManuals.length === 0) {
        alert('파싱 가능한 매뉴얼이 없습니다.\n\n엑셀 형식이 올바른지 확인해주세요.');
        return;
      }
      
      // Calculate total ingredients
      const totalIngredients = allManuals.reduce((sum, m) => sum + (m.ingredients?.length || 0), 0);
      
      setExcelPreviewData({
        parsedCount: allManuals.length,
        totalSheets: workbook.SheetNames.length,
        totalIngredients,
        allManuals
      });
      
      // For large files, show chunk confirmation
      if (allManuals.length > 10) {
        setPendingManuals(allManuals);
        setChunkProgress({ current: 0, total: allManuals.length, saved: 0 });
      }
      
    } catch (error: any) {
      console.error('❌ Excel parsing error:', error);
      alert(`파일 분석 중 오류가 발생했습니다.\n\n오류: ${error?.message || '알 수 없는 오류'}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Upload manuals in chunks
  const uploadChunk = async (manuals: any[], startIdx: number, chunkSize: number = 10) => {
    const chunk = manuals.slice(startIdx, startIdx + chunkSize);
    if (chunk.length === 0) return { success: true, count: 0 };
    
    const res = await fetch('/api/manuals/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        importMode: 'import-direct',
        manuals: chunk
      })
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Upload failed');
    }
    
    const data = await res.json();
    return { success: true, count: data.importedCount };
  };

  // Chunked upload with confirmation
  const handleChunkedUpload = async () => {
    if (pendingManuals.length === 0) return;
    
    const CHUNK_SIZE = 10;
    let currentIdx = chunkProgress?.saved || 0;
    const total = pendingManuals.length;
    
    setIsUploading(true);
    
    try {
      while (currentIdx < total) {
        // Upload one chunk
        const result = await uploadChunk(pendingManuals, currentIdx, CHUNK_SIZE);
        const newSaved = currentIdx + result.count;
        
        setChunkProgress({ current: currentIdx, total, saved: newSaved });
        
        const remaining = total - newSaved;
        
        if (remaining > 0) {
          // Ask user to continue
          const continueUpload = confirm(
            `✅ ${newSaved}개 저장 완료!\n\n남은 매뉴얼: ${remaining}개\n\n계속 진행하시겠습니까?`
          );
          
          if (!continueUpload) {
            alert(`업로드 중단됨.\n\n저장 완료: ${newSaved}개\n미저장: ${remaining}개`);
            break;
          }
        }
        
        currentIdx = newSaved;
      }
      
      if (currentIdx >= total) {
        alert(`✅ 모든 매뉴얼 업로드 완료!\n\n총 ${total}개 매뉴얼이 저장되었습니다.`);
        setShowExcelUploadModal(false);
        setExcelFile(null);
        setExcelPreviewData(null);
        setExcelConfirmedManuals(new Set());
        setExcelPreviewIndex(0);
        setPendingManuals([]);
        setChunkProgress(null);
        fetchData();
      }
      
    } catch (error: any) {
      console.error('Chunk upload error:', error);
      alert(`업로드 오류: ${error.message}\n\n저장 완료: ${chunkProgress?.saved || 0}개`);
    } finally {
      setIsUploading(false);
    }
  };

  // Import Excel manuals (only confirmed ones)
  const handleExcelImport = async () => {
    if (!excelFile || !excelPreviewData?.allManuals || excelConfirmedManuals.size === 0) return;
    
    // Get only confirmed manuals
    const confirmedManualData = excelPreviewData.allManuals.filter((_: any, idx: number) => 
      excelConfirmedManuals.has(idx)
    );
    
    setIsUploading(true);
    try {
      // Send confirmed manuals directly instead of re-parsing the file
      const res = await fetch('/api/manuals/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importMode: 'import-direct',
          manuals: confirmedManualData
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`${data.importedCount}개 매뉴얼이 가져오기 되었습니다.`);
        setShowExcelUploadModal(false);
        setExcelFile(null);
        setExcelPreviewData(null);
        setExcelConfirmedManuals(new Set());
        setExcelPreviewIndex(0);
        fetchData();
      } else {
        const error = await res.json();
        alert(`가져오기 실패: ${error.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('Excel import error:', error);
      alert('가져오기 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
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
    } else if (activeTab === 'countryManuals') {
      // Show only country copies (non-master)
      filtered = filtered.filter(m => (m as any).isMaster === false || (m as any).isMaster === 0);
      // Further filter by selected country template
      if (countryFilterTemplateId) {
        filtered = filtered.filter(m => (m as any).priceTemplateId === countryFilterTemplateId);
      }
    } else {
      // Show active (not archived) manuals - for manuals tab, show only masters
      filtered = filtered.filter(m => !(m as any).isArchived);
      if (activeTab === 'manuals') {
        // Show only master manuals (isMaster = true or null for legacy)
        filtered = filtered.filter(m => (m as any).isMaster !== false && (m as any).isMaster !== 0);
      }
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
            // Get country from price template
            aValue = ((a as any).priceTemplate?.country || '').toLowerCase();
            bValue = ((b as any).priceTemplate?.country || '').toLowerCase();
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
            매뉴얼 마스터 ({savedManuals.filter(m => !(m as any).isArchived && (m as any).isMaster !== false && (m as any).isMaster !== 0).length})
          </button>
          <button
            onClick={() => setActiveTab('countryManuals')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'countryManuals' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Globe className="w-4 h-4 inline mr-2" />
            국가별 매뉴얼 ({savedManuals.filter(m => (m as any).isMaster === false || (m as any).isMaster === 0).length})
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
            Trash ({savedManuals.filter(m => !!(m as any).isArchived).length})
          </button>
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
                <p className="text-sm text-gray-500">조리구분을 선택하고 한글로 입력하면 AI가 영문으로 번역합니다.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCookingSteps([...cookingSteps, { process: '', manual: '', translatedManual: '' }])}
                  className="flex items-center px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  단계 추가
                </button>
                <button
                  onClick={translateAllCookingMethods}
                  disabled={isTranslating}
                  className="flex items-center px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${isTranslating ? 'animate-spin' : ''}`} />
                  {isTranslating ? 'Translating...' : 'Translate All'}
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {cookingSteps.map((step, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 items-start">
                  {/* Process Dropdown */}
                  <div className="col-span-3">
                    <select
                      value={step.process}
                      onChange={(e) => {
                        const newSteps = [...cookingSteps];
                        newSteps[i] = { ...newSteps[i], process: e.target.value };
                        setCookingSteps(newSteps);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
                    >
                      <option value="">조리구분 선택</option>
                      {DEFAULT_COOKING_PROCESSES.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {step.process === 'Custom' && (
                      <input
                        type="text"
                        placeholder="직접 입력..."
                        value={step.process === 'Custom' ? '' : step.process}
                        onChange={(e) => {
                          const newSteps = [...cookingSteps];
                          newSteps[i] = { ...newSteps[i], process: e.target.value };
                          setCookingSteps(newSteps);
                        }}
                        className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    )}
                  </div>
                  {/* Manual Input */}
                  <div className="col-span-8 space-y-2">
                    <textarea
                      value={step.manual}
                      onChange={(e) => updateCookingStep(i, e.target.value)}
                      onBlur={() => step.manual && translateCookingMethod(i)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[60px]"
                      placeholder={`${step.process || '조리 방법'} 지침 입력 (한글 가능)...`}
                    />
                    {step.translatedManual && (
                      <div className="bg-green-50 border border-green-200 rounded p-2 text-sm text-green-800">
                        <span className="font-medium">EN: </span>{step.translatedManual}
                      </div>
                    )}
                  </div>
                  {/* Delete Button */}
                  <div className="col-span-1 flex justify-center pt-2">
                    <button
                      onClick={() => {
                        const newSteps = cookingSteps.filter((_, idx) => idx !== i);
                        setCookingSteps(newSteps.length > 0 ? newSteps : [{ process: '', manual: '', translatedManual: '' }]);
                      }}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                      title="이 단계 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editor Preview Mode */}
      {activeTab === 'editor' && showPreview && (
        <div className="bg-white rounded-lg shadow p-6 print:shadow-none print:p-0">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="border-b pb-4 mb-6">
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="border-b">
                    <td className="bg-gray-100 font-medium px-4 py-2 w-24 text-sm">Name</td>
                    <td className="px-4 py-2 text-lg font-bold">{menuName || '(메뉴명 없음)'}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="bg-gray-100 font-medium px-4 py-2 w-24 text-sm">한글명</td>
                    <td className="px-4 py-2">{menuNameKo || '-'}</td>
                  </tr>
                  <tr>
                    <td className="bg-gray-100 font-medium px-4 py-2 w-24 text-sm">사진</td>
                    <td className="px-4 py-2">
                      {menuImageUrl ? (
                        <img src={menuImageUrl} alt={menuName} className="max-w-xs max-h-48 object-contain rounded" />
                      ) : (
                        <span className="text-gray-400">이미지 없음</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Ingredients Section */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3">Ingredients Composition</h3>
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border px-3 py-2 text-left w-12">No.</th>
                    <th className="border px-3 py-2 text-left">Ingredients</th>
                    <th className="border px-3 py-2 text-right w-24">Qty</th>
                    <th className="border px-3 py-2 text-center w-16">Unit</th>
                    <th className="border px-3 py-2 text-left w-24">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.filter(ing => ing.name || ing.koreanName).map((ing, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? 'bg-gray-50' : ''}>
                      <td className="border px-3 py-2 text-center">{idx + 1}</td>
                      <td className="border px-3 py-2">{ing.koreanName || ing.name}</td>
                      <td className="border px-3 py-2 text-right">{ing.weight || '-'}</td>
                      <td className="border px-3 py-2 text-center">{ing.unit || 'g'}</td>
                      <td className="border px-3 py-2">{ing.purchase || 'Local'}</td>
                    </tr>
                  ))}
                  {ingredients.filter(ing => ing.name || ing.koreanName).length === 0 && (
                    <tr>
                      <td colSpan={5} className="border px-3 py-8 text-center text-gray-400">
                        식재료 정보가 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cooking Method Section */}
            <div>
              <h3 className="text-lg font-bold mb-3">COOKING METHOD</h3>
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border px-3 py-2 text-left w-40">PROCESS</th>
                    <th className="border px-3 py-2 text-left">MANUAL</th>
                  </tr>
                </thead>
                <tbody>
                  {cookingSteps.filter(s => s.process || s.manual).map((step, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? 'bg-gray-50' : ''}>
                      <td className="border px-3 py-2 font-medium align-top">{step.process || '-'}</td>
                      <td className="border px-3 py-2">
                        {step.translatedManual || step.manual || '-'}
                      </td>
                    </tr>
                  ))}
                  {cookingSteps.filter(s => s.process || s.manual).length === 0 && (
                    <tr>
                      <td colSpan={2} className="border px-3 py-8 text-center text-gray-400">
                        조리 방법 정보가 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Saved Manuals, Trash & Country Manuals Tab */}
      {(activeTab === 'manuals' || activeTab === 'trash' || activeTab === 'archived' || activeTab === 'countryManuals') && (
        <div className="space-y-4">
          {/* Controls Row */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-end gap-4 flex-wrap">
              {/* Left: Info */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {activeTab === 'countryManuals' ? '국가별 매뉴얼' : '매뉴얼 마스터'}
                </label>
                <p className="text-sm text-gray-500">
                  {activeTab === 'countryManuals' 
                    ? `총 ${savedManuals.filter(m => (m as any).isMaster === false || (m as any).isMaster === 0).length}개 국가별 매뉴얼`
                    : `총 ${savedManuals.filter(m => !(m as any).isArchived && (m as any).isMaster !== false).length}개 마스터 매뉴얼`
                  }
                </p>
              </div>

              {/* Excel Upload Button (for manuals tab) */}
              {activeTab === 'manuals' && (
                <button
                  onClick={() => setShowExcelUploadModal(true)}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  엑셀 업로드
                </button>
              )}

              {/* Country Filter (for countryManuals tab) */}
              {activeTab === 'countryManuals' && (
                <div className="min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">국가 필터</label>
                  <select
                    value={countryFilterTemplateId}
                    onChange={(e) => setCountryFilterTemplateId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">모든 국가</option>
                    {priceTemplates.filter(t => t.name !== "Master Template").map(t => (
                      <option key={t.id} value={t.id}>{t.country}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Clone to Country (for manuals tab) */}
              {activeTab === 'manuals' && selectedManualIds.size > 0 && (
                <div className="min-w-[250px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Copy className="w-4 h-4 inline mr-1" />
                    국가 템플릿에 복제 ({selectedManualIds.size}개 선택)
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={cloneTemplateId}
                      onChange={(e) => setCloneTemplateId(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">국가 선택...</option>
                      {priceTemplates.filter(t => t.name !== "Master Template").map(t => (
                        <option key={t.id} value={t.id}>{t.country}</option>
                      ))}
                    </select>
                    <button
                      onClick={cloneToCountryTemplate}
                      disabled={!cloneTemplateId || isCloning}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center"
                    >
                      {isCloning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Right: Actions */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {selectedManualIds.size > 0 ? (
                    <span className="text-blue-600 font-semibold">{selectedManualIds.size}개 선택됨</span>
                  ) : (
                    '선택 작업'
                  )}
                </label>
                <div className="flex gap-2 justify-end">
                  {(activeTab === 'manuals' || activeTab === 'countryManuals') && (
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
                  {activeTab === 'countryManuals' && (
                    <th onClick={() => handleSort('country')} className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100">
                      국가 <SortIcon field="country" />
                    </th>
                  )}
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
                      {activeTab === 'countryManuals' && (
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Globe className="w-3 h-3 mr-1" />
                            {(manual as any).priceTemplate?.country || '국가 미지정'}
                          </span>
                        </td>
                      )}
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
                          {(activeTab === 'manuals' || activeTab === 'countryManuals') && (
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
                    // Calculate cost from ingredients: (사용량 / 기준수량) × 단가
                    const ingredientCount = manual.ingredients?.length || 0;
                    const totalCost = manual.ingredients?.reduce((sum: number, ing: any) => {
                      const usageQty = ing.quantity || 0; // 매뉴얼에서 실제 사용량
                      const baseQty = ing.baseQuantity || 1; // pricing 기준 수량 (0이면 1로)
                      const price = ing.unitPrice || 0; // pricing 가격
                      // 원가 = (사용량 / 기준수량) × 가격
                      const cost = baseQty > 0 ? (usageQty / baseQty) * price : 0;
                      return sum + cost;
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
              <strong>원가 계산 방법:</strong> (사용량 / 기준수량) × 단가<br/>
              예) Pricing에서 1,000g에 $10 → 매뉴얼에서 100g 사용 → 원가 = (100 / 1000) × $10 = $1
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

      {/* Excel Upload Modal with Individual Preview */}
      {showExcelUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">엑셀 파일에서 매뉴얼 가져오기</h2>
              <button onClick={() => { setShowExcelUploadModal(false); setExcelFile(null); setExcelPreviewData(null); setExcelConfirmedManuals(new Set()); setExcelPreviewIndex(0); }}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* File Input */}
              {!excelPreviewData && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-4">엑셀 파일(.xlsx)을 선택해주세요</p>
                  <label className="cursor-pointer bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600">
                    파일 선택
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelFileSelect}
                      className="hidden"
                    />
                  </label>
                  {isUploading && (
                    <p className="mt-4 text-gray-500 flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      파일 분석 중...
                    </p>
                  )}
                </div>
              )}

              {/* Individual Manual Preview */}
              {excelPreviewData && excelPreviewData.allManuals?.length > 0 && (
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="bg-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">
                        {excelPreviewIndex + 1} / {excelPreviewData.allManuals.length} 매뉴얼
                      </span>
                      <span className="text-sm text-gray-500">
                        확인 완료: {excelConfirmedManuals.size}개
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(excelConfirmedManuals.size / excelPreviewData.allManuals.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Navigation Arrows and Manual Preview */}
                  <div className="flex items-stretch gap-4">
                    {/* Left Arrow */}
                    <button
                      onClick={() => setExcelPreviewIndex(Math.max(0, excelPreviewIndex - 1))}
                      disabled={excelPreviewIndex === 0}
                      className="px-3 py-6 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>

                    {/* Manual Preview Card */}
                    <div className="flex-1 border rounded-lg overflow-hidden">
                      {(() => {
                        const currentManual = excelPreviewData.allManuals[excelPreviewIndex];
                        const isConfirmed = excelConfirmedManuals.has(excelPreviewIndex);
                        return (
                          <div className={`${isConfirmed ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                            {/* Manual Header */}
                            <div className={`px-4 py-3 border-b flex justify-between items-center ${isConfirmed ? 'bg-green-100' : 'bg-gray-50'}`}>
                              <div>
                                <h3 className="font-bold text-lg">{currentManual.name || currentManual.koreanName || '(이름 없음)'}</h3>
                                {currentManual.koreanName && currentManual.name !== currentManual.koreanName && (
                                  <p className="text-sm text-gray-500">{currentManual.koreanName}</p>
                                )}
                              </div>
                              {isConfirmed && (
                                <span className="px-3 py-1 bg-green-500 text-white rounded-full text-sm flex items-center">
                                  <Check className="w-4 h-4 mr-1" /> 확인됨
                                </span>
                              )}
                              {currentManual.hasLinkingIssue && (
                                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                                  확인 필요
                                </span>
                              )}
                            </div>

                            {/* Manual Content */}
                            <div className="p-4 grid grid-cols-2 gap-6">
                              {/* Left: Basic Info & Ingredients */}
                              <div className="space-y-4">
                                {/* Basic Info */}
                                <div>
                                  <h4 className="font-semibold text-sm text-gray-600 mb-2">기본 정보</h4>
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="bg-gray-50 p-2 rounded">
                                      <span className="text-gray-500">메뉴명:</span>
                                      <span className="ml-2 font-medium">{currentManual.name || '-'}</span>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded">
                                      <span className="text-gray-500">판매가:</span>
                                      <span className="ml-2 font-medium">{currentManual.sellingPrice || '-'}</span>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded">
                                      <span className="text-gray-500">유통기한:</span>
                                      <span className="ml-2 font-medium">{currentManual.shelfLife || '-'}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Ingredients */}
                                <div>
                                  <h4 className="font-semibold text-sm text-gray-600 mb-2">
                                    식재료 ({currentManual.ingredients?.length || 0}개)
                                  </h4>
                                  <div className="border rounded max-h-48 overflow-y-auto">
                                    <table className="w-full text-xs">
                                      <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                          <th className="px-2 py-1 text-left">재료명</th>
                                          <th className="px-2 py-1 text-right">용량</th>
                                          <th className="px-2 py-1 text-center">단위</th>
                                          <th className="px-2 py-1 text-left">구매</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {currentManual.ingredients?.map((ing: any, idx: number) => (
                                          <tr key={idx}>
                                            <td className="px-2 py-1">{ing.name || ing.koreanName}</td>
                                            <td className="px-2 py-1 text-right">{ing.quantity || '-'}</td>
                                            <td className="px-2 py-1 text-center">{ing.unit || '-'}</td>
                                            <td className="px-2 py-1">{ing.purchase || '-'}</td>
                                          </tr>
                                        ))}
                                        {(!currentManual.ingredients || currentManual.ingredients.length === 0) && (
                                          <tr>
                                            <td colSpan={4} className="px-2 py-4 text-center text-gray-400">
                                              식재료 정보 없음
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>

                              {/* Right: Cooking Method */}
                              <div>
                                <h4 className="font-semibold text-sm text-gray-600 mb-2">
                                  조리 방법 ({currentManual.cookingMethod?.length || 0}단계)
                                </h4>
                                <div className="border rounded max-h-64 overflow-y-auto">
                                  {currentManual.cookingMethod?.map((step: any, idx: number) => (
                                    <div key={idx} className="px-3 py-2 border-b last:border-b-0 text-sm">
                                      <div className="font-medium text-orange-600">{step.process}</div>
                                      <div className="text-gray-700 mt-1">{step.manual}</div>
                                    </div>
                                  ))}
                                  {(!currentManual.cookingMethod || currentManual.cookingMethod.length === 0) && (
                                    <div className="px-3 py-4 text-center text-gray-400 text-sm">
                                      조리 방법 정보 없음
                                    </div>
                                  )}
                                </div>

                                {/* Issues */}
                                {currentManual.issueDetails?.length > 0 && (
                                  <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded text-sm">
                                    <div className="font-medium text-orange-700 mb-1">확인 필요 사항:</div>
                                    <ul className="list-disc list-inside text-orange-600 text-xs">
                                      {currentManual.issueDetails.map((issue: string, idx: number) => (
                                        <li key={idx}>{issue}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Confirm Button */}
                            <div className="px-4 py-3 border-t bg-gray-50 flex justify-center gap-3">
                              <button
                                onClick={() => {
                                  const newConfirmed = new Set(excelConfirmedManuals);
                                  if (newConfirmed.has(excelPreviewIndex)) {
                                    newConfirmed.delete(excelPreviewIndex);
                                  } else {
                                    newConfirmed.add(excelPreviewIndex);
                                  }
                                  setExcelConfirmedManuals(newConfirmed);
                                  // Auto advance to next if confirmed
                                  if (!excelConfirmedManuals.has(excelPreviewIndex) && excelPreviewIndex < excelPreviewData.allManuals.length - 1) {
                                    setExcelPreviewIndex(excelPreviewIndex + 1);
                                  }
                                }}
                                className={`px-4 py-2 rounded-lg flex items-center ${
                                  isConfirmed 
                                    ? 'bg-gray-300 text-gray-700 hover:bg-gray-400' 
                                    : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                              >
                                <Check className="w-4 h-4 mr-2" />
                                {isConfirmed ? '확인 취소' : '확인 완료'}
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Right Arrow */}
                    <button
                      onClick={() => setExcelPreviewIndex(Math.min(excelPreviewData.allManuals.length - 1, excelPreviewIndex + 1))}
                      disabled={excelPreviewIndex >= excelPreviewData.allManuals.length - 1}
                      className="px-3 py-6 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Thumbnail Navigation */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {excelPreviewData.allManuals.map((m: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setExcelPreviewIndex(idx)}
                          className={`flex-shrink-0 px-3 py-2 rounded text-xs border transition-all ${
                            idx === excelPreviewIndex 
                              ? 'bg-orange-500 text-white border-orange-500' 
                              : excelConfirmedManuals.has(idx)
                                ? 'bg-green-100 text-green-700 border-green-300'
                                : m.hasLinkingIssue
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                          }`}
                        >
                          {excelConfirmedManuals.has(idx) && <Check className="w-3 h-3 inline mr-1" />}
                          {idx + 1}. {(m.name || m.koreanName || '이름없음').slice(0, 10)}...
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {excelPreviewData?.allManuals?.length > 0 && (
                  <span>
                    {chunkProgress 
                      ? `📦 청크 업로드: ${chunkProgress.saved}/${chunkProgress.total} 저장됨`
                      : excelConfirmedManuals.size === excelPreviewData.allManuals.length 
                        ? '✅ 모든 매뉴얼 확인 완료!'
                        : `${excelPreviewData.allManuals.length - excelConfirmedManuals.size}개 매뉴얼 확인 대기 중`
                    }
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowExcelUploadModal(false); setExcelFile(null); setExcelPreviewData(null); setExcelConfirmedManuals(new Set()); setExcelPreviewIndex(0); setPendingManuals([]); setChunkProgress(null); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                {excelPreviewData?.allManuals?.length > 0 && (
                  <>
                    {/* Confirm All Button */}
                    <button
                      onClick={() => {
                        const allIndices = new Set<number>(excelPreviewData.allManuals.map((_: any, idx: number) => idx));
                        setExcelConfirmedManuals(allIndices);
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
                    >
                      <CheckCheck className="w-4 h-4 mr-2" />
                      전체 확인
                    </button>
                    
                    {/* Chunked Upload Button - for large datasets */}
                    {pendingManuals.length > 10 && (
                      <button
                        onClick={handleChunkedUpload}
                        disabled={isUploading}
                        className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        {isUploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        청크 업로드 ({pendingManuals.length}개)
                      </button>
                    )}
                    
                    {/* Import Button - for small datasets or confirmed manuals */}
                    {pendingManuals.length <= 10 && (
                      <button
                        onClick={handleExcelImport}
                        disabled={isUploading || excelConfirmedManuals.size === 0}
                        className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        {isUploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        확인된 {excelConfirmedManuals.size}개 가져오기
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



