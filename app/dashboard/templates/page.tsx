'use client';
/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import { FileText, Download, Plus, Trash2, Eye, Save, RefreshCw, Settings, Table, Search, X, Edit, ChevronDown, ChevronLeft, ChevronRight, Upload, Image, ChevronUp, Archive, History, Globe, Copy, Check, CheckCheck, FileSpreadsheet, DollarSign, Package } from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { extractShapeTextsFromExcel, ShapeTextInfo } from '@/lib/excelShapeParser';
import { matchProcessPng, DEFAULT_PROCESS_ASSET_INDEX, ProcessAssetIndex } from '@/lib/processAssets';
import { useItemsPerPage, getItemsPerPageLabel, ITEMS_PER_PAGE_OPTIONS } from '@/lib/useItemsPerPage';

// Extract images from Excel file using JSZip
async function extractImagesFromExcel(buffer: ArrayBuffer): Promise<Map<string, string>> {
  const sheetImages = new Map<string, string>(); // sheetName -> base64 data URL
  
  try {
    const zip = await JSZip.loadAsync(buffer);
    
    // 1. Get all image files from xl/media/ (imageN.xxx)
    const mediaFiles = new Map<string, string>(); // image1.png -> base64 data URL
    const mediaFolder = zip.folder('xl/media');
    
    if (mediaFolder) {
      const promises: Promise<void>[] = [];
      
      mediaFolder.forEach((relativePath, file) => {
        if (!file.dir && /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(relativePath)) {
          promises.push(
            file.async('base64').then(data => {
              const ext = relativePath.split('.').pop()?.toLowerCase() || 'png';
              const mimeType = ext === 'jpg' ? 'jpeg' : ext;
              // Key: image1.png, image2.jpeg, etc.
              mediaFiles.set(relativePath, `data:image/${mimeType};base64,${data}`);
            })
          );
        }
      });
      
      await Promise.all(promises);
    }
    
    console.log(`📷 Client: Found ${mediaFiles.size} images in Excel file:`, Array.from(mediaFiles.keys()));
    
    if (mediaFiles.size === 0) return sheetImages;
    
    // 2. Parse workbook.xml.rels to find rId -> sheet file mapping
    const workbookRelsContent = await zip.file('xl/_rels/workbook.xml.rels')?.async('text');
    const rIdToSheetFile = new Map<string, string>(); // rId1 -> sheet1.xml
    
    if (workbookRelsContent) {
      // <Relationship Id="rId1" Target="worksheets/sheet1.xml" .../>
      const relPattern = /<Relationship[^>]+Id="(rId\d+)"[^>]+Target="worksheets\/(sheet\d+\.xml)"/g;
      let match;
      while ((match = relPattern.exec(workbookRelsContent)) !== null) {
        rIdToSheetFile.set(match[1], match[2]);
      }
      // Alternative pattern (Target before Id)
      const relPattern2 = /<Relationship[^>]+Target="worksheets\/(sheet\d+\.xml)"[^>]+Id="(rId\d+)"/g;
      while ((match = relPattern2.exec(workbookRelsContent)) !== null) {
        rIdToSheetFile.set(match[2], match[1]);
      }
    }
    
    // 3. Parse workbook.xml to get sheet display order and their rIds
    const workbookContent = await zip.file('xl/workbook.xml')?.async('text');
    const sheetNameToFile = new Map<string, string>(); // "Pa-Dak (Boneless)" -> sheet1.xml
    
    if (workbookContent) {
      // <sheet name="Pa-Dak (Boneless)" sheetId="1" r:id="rId1"/>
      const sheetPattern = /<sheet[^>]+name="([^"]+)"[^>]+r:id="(rId\d+)"[^>]*\/?>/g;
      let match;
      while ((match = sheetPattern.exec(workbookContent)) !== null) {
        const sheetName = match[1];
        const rId = match[2];
        const sheetFile = rIdToSheetFile.get(rId);
        if (sheetFile) {
          sheetNameToFile.set(sheetName, sheetFile);
        }
      }
    }
    
    console.log(`📷 Sheet name to file mapping:`, Object.fromEntries(sheetNameToFile));
    
    // 4. For each sheet, find which drawing it uses and find the PRODUCT PHOTO (top area, row < 15)
    for (const [sheetName, sheetFile] of sheetNameToFile) {
      // sheetFile = "sheet1.xml" -> check xl/worksheets/_rels/sheet1.xml.rels
      const sheetRelsPath = `xl/worksheets/_rels/${sheetFile}.rels`;
      const sheetRelsContent = await zip.file(sheetRelsPath)?.async('text');
      
      if (!sheetRelsContent) continue;
      
      // Find drawing reference: Target="../drawings/drawing1.xml"
      const drawingMatch = sheetRelsContent.match(/Target="\.\.\/drawings\/(drawing\d+\.xml)"/);
      if (!drawingMatch) continue;
      
      const drawingFile = drawingMatch[1]; // drawing1.xml
      
      // 5. Read the drawing XML to find image positions
      const drawingPath = `xl/drawings/${drawingFile}`;
      const drawingContent = await zip.file(drawingPath)?.async('text');
      
      // 6. Check the drawing's rels file for rId -> image file mapping
      const drawingRelsPath = `xl/drawings/_rels/${drawingFile}.rels`;
      const drawingRelsContent = await zip.file(drawingRelsPath)?.async('text');
      
      if (!drawingRelsContent || !drawingContent) continue;
      
      // Build rId -> image file mapping
      const rIdToImage = new Map<string, string>();
      const imageRelPattern = /<Relationship[^>]+Id="(rId\d+)"[^>]+Target="\.\.\/media\/(image\d+\.[a-z]+)"/gi;
      let relMatch;
      while ((relMatch = imageRelPattern.exec(drawingRelsContent)) !== null) {
        rIdToImage.set(relMatch[1], relMatch[2]);
      }
      // Alternative pattern
      const imageRelPattern2 = /<Relationship[^>]+Target="\.\.\/media\/(image\d+\.[a-z]+)"[^>]+Id="(rId\d+)"/gi;
      while ((relMatch = imageRelPattern2.exec(drawingRelsContent)) !== null) {
        rIdToImage.set(relMatch[2], relMatch[1]);
      }
      
      // 7. Parse drawing XML to find image anchors with their positions
      // Look for <xdr:twoCellAnchor> with <xdr:from><xdr:row> for position
      // Product photo is in rows 2-10 (0-indexed), process icons are in rows 31+
      interface ImageAnchor {
        rId: string;
        row: number;
        col: number;
      }
      
      const imageAnchors: ImageAnchor[] = [];
      
      // Pattern to find twoCellAnchor with blip (image)
      // <xdr:twoCellAnchor>...<xdr:from><xdr:col>2</xdr:col><xdr:row>2</xdr:row>...</xdr:from>...<a:blip r:embed="rId1"/>...</xdr:twoCellAnchor>
      const anchorPattern = /<xdr:twoCellAnchor[^>]*>([\s\S]*?)<\/xdr:twoCellAnchor>/g;
      let anchorMatch;
      
      while ((anchorMatch = anchorPattern.exec(drawingContent)) !== null) {
        const anchorContent = anchorMatch[1];
        
        // Extract position from <xdr:from>
        const fromMatch = anchorContent.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>[\s\S]*?<\/xdr:from>/);
        if (!fromMatch) continue;
        
        const col = parseInt(fromMatch[1], 10);
        const row = parseInt(fromMatch[2], 10);
        
        // Extract image rId from <a:blip r:embed="rId1"/>
        const blipMatch = anchorContent.match(/<a:blip[^>]+r:embed="(rId\d+)"/);
        if (!blipMatch) continue;
        
        const rId = blipMatch[1];
        imageAnchors.push({ rId, row, col });
      }
      
      // Also check oneCellAnchor
      const oneCellAnchorPattern = /<xdr:oneCellAnchor[^>]*>([\s\S]*?)<\/xdr:oneCellAnchor>/g;
      while ((anchorMatch = oneCellAnchorPattern.exec(drawingContent)) !== null) {
        const anchorContent = anchorMatch[1];
        
        const fromMatch = anchorContent.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>[\s\S]*?<\/xdr:from>/);
        if (!fromMatch) continue;
        
        const col = parseInt(fromMatch[1], 10);
        const row = parseInt(fromMatch[2], 10);
        
        const blipMatch = anchorContent.match(/<a:blip[^>]+r:embed="(rId\d+)"/);
        if (!blipMatch) continue;
        
        const rId = blipMatch[1];
        imageAnchors.push({ rId, row, col });
      }
      
      console.log(`📷 Sheet "${sheetName}" has ${imageAnchors.length} images:`, imageAnchors.map(a => ({ rId: a.rId, row: a.row, col: a.col })));
      
      // 8. Find the product photo: image in top area (row < 15) and column >= 2 (C column or right)
      // Sort by row to get the topmost image first
      const productPhotoAnchors = imageAnchors
        .filter(a => a.row < 15 && a.col >= 2) // Top area, C column or right
        .sort((a, b) => a.row - b.row);
      
      if (productPhotoAnchors.length > 0) {
        const productAnchor = productPhotoAnchors[0];
        const imageFileName = rIdToImage.get(productAnchor.rId);
        
        if (imageFileName) {
          const imageData = mediaFiles.get(imageFileName);
          if (imageData) {
            sheetImages.set(sheetName, imageData);
            console.log(`📷 ✅ Assigned product photo ${imageFileName} (row ${productAnchor.row}, col ${productAnchor.col}) to sheet: ${sheetName}`);
            continue; // Move to next sheet
          }
        }
      }
      
      // 9. Fallback: if no image found in top area, try the topmost image regardless of column
      const sortedByRow = [...imageAnchors].sort((a, b) => a.row - b.row);
      if (sortedByRow.length > 0) {
        const topImage = sortedByRow[0];
        const imageFileName = rIdToImage.get(topImage.rId);
        
        if (imageFileName) {
          const imageData = mediaFiles.get(imageFileName);
          if (imageData) {
            sheetImages.set(sheetName, imageData);
            console.log(`📷 ⚠️ Fallback: Assigned topmost image ${imageFileName} (row ${topImage.row}) to sheet: ${sheetName}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Client: Error extracting images:', error);
  }
  
  return sheetImages;
}

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
  pngFilename?: string | null; // 프로세스 PNG 파일명
  processMatchInfo?: {
    originalText: string;
    matchMethod: string;
    matchScore: number;
    needsVerification: boolean;
  } | null;
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
  hasUnassignedProcess?: boolean;
  linkingStats?: {
    total: number;
    linked: number;
    unlinked: number;
    isFullyLinked: boolean;
    hasUnlinked: boolean;
  };
  processStats?: {
    total: number;
    assigned: number;
    unassigned: number;
    isFullyAssigned: boolean;
  };
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

// PNG 파일명 기반 프로세스 드롭다운 옵션
const DEFAULT_COOKING_PROCESSES = [
  'Ingredients Preparation',
  'Marination',
  '2nd Marination',
  'Batter Mix Solution',
  'Battering',
  'Breading',
  'Frying',
  'Grill',
  'Cooking',
  'Saute',
  'Sauce Mix',
  'Brushing Sauce',
  'Seasoning Toss',
  'Assembling',
  'Serving',
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
  // 마스터 계정: MASTER_ADMIN role 또는 admin@bbq.com 또는 kun.lee@bbqchickenca.com
  const userRole = (session?.user as any)?.role;
  const isMasterAdmin = userRole === 'MASTER_ADMIN';
  const isMaster = isMasterAdmin || session?.user?.email === 'admin@bbq.com' || session?.user?.email === 'kun.lee@bbqchickenca.com';
  const [activeTab, setActiveTab] = useState<'editor' | 'manuals' | 'countryManuals' | 'costTable' | 'trash' | 'archived'>('editor');
  
  // Editor State
  const [menuName, setMenuName] = useState('');
  const [menuNameKo, setMenuNameKo] = useState('');
  const [shelfLife, setShelfLife] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [ingredients, setIngredients] = useState<ManualIngredient[]>([{ ...EMPTY_INGREDIENT }]);
  const [cookingSteps, setCookingSteps] = useState<CookingStep[]>(
    Array(8).fill(null).map(() => ({ process: '', manual: '', translatedManual: '' }))
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
  const [countryFilterTemplateId, setCountryFilterTemplateId] = useState<string>('__select__'); // Country filter: __select__ = choose, '' = all, id = specific
  
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
  
  // Linking filter state
  const [linkingFilter, setLinkingFilter] = useState<'all' | 'linked' | 'unlinked'>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  // 페이지당 아이템 수 - 탭별로 관리
  const { itemsPerPage: manualsItemsPerPage, setItemsPerPage: setManualsItemsPerPage, getNumericValue: getManualsNumeric } = useItemsPerPage('templates_manuals');
  const { itemsPerPage: countryItemsPerPage, setItemsPerPage: setCountryItemsPerPage, getNumericValue: getCountryNumeric } = useItemsPerPage('templates_country');
  const { itemsPerPage: trashItemsPerPage, setItemsPerPage: setTrashItemsPerPage, getNumericValue: getTrashNumeric } = useItemsPerPage('templates_trash');
  const { itemsPerPage: archivedItemsPerPage, setItemsPerPage: setArchivedItemsPerPage, getNumericValue: getArchivedNumeric } = useItemsPerPage('templates_archived');
  const { itemsPerPage: costTableItemsPerPage, setItemsPerPage: setCostTableItemsPerPage, getNumericValue: getCostTableNumeric } = useItemsPerPage('templates_costTable');

  // 현재 탭에 따른 itemsPerPage 가져오기
  const getCurrentItemsPerPage = () => {
    switch (activeTab) {
      case 'manuals': return manualsItemsPerPage;
      case 'countryManuals': return countryItemsPerPage;
      case 'trash': return trashItemsPerPage;
      case 'archived': return archivedItemsPerPage;
      case 'costTable': return costTableItemsPerPage;
      default: return manualsItemsPerPage;
    }
  };
  
  const setCurrentItemsPerPage = (value: typeof manualsItemsPerPage) => {
    switch (activeTab) {
      case 'manuals': setManualsItemsPerPage(value); break;
      case 'countryManuals': setCountryItemsPerPage(value); break;
      case 'trash': setTrashItemsPerPage(value); break;
      case 'archived': setArchivedItemsPerPage(value); break;
      case 'costTable': setCostTableItemsPerPage(value); break;
      default: setManualsItemsPerPage(value);
    }
    setCurrentPage(1); // 페이지 수 변경 시 첫 페이지로
  };

  const getCurrentNumericItemsPerPage = (total: number) => {
    switch (activeTab) {
      case 'manuals': return getManualsNumeric(total);
      case 'countryManuals': return getCountryNumeric(total);
      case 'trash': return getTrashNumeric(total);
      case 'archived': return getArchivedNumeric(total);
      case 'costTable': return getCostTableNumeric(total);
      default: return getManualsNumeric(total);
    }
  };

  // Version history state
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionHistory, setVersionHistory] = useState<any>(null);
  const [selectedVersionManual, setSelectedVersionManual] = useState<SavedManual | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<any>(null); // Version preview

  // Search state for each tab
  const [masterSearch, setMasterSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [costTableSearch, setCostTableSearch] = useState('');
  const [trashSearch, setTrashSearch] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');

  // Category filter state
  const [categories, setCategories] = useState<string[]>(['치킨', '사이드', '음료', '소스', '기타']);
  const [masterCategoryFilter, setMasterCategoryFilter] = useState<string>('');
  const [countryCategoryFilter, setCountryCategoryFilter] = useState<string>('');
  const [costTableCategoryFilter, setCostTableCategoryFilter] = useState<string>('');
  
  // Bulk category assignment (Country Manuals)
  const [selectedManualsForCategory, setSelectedManualsForCategory] = useState<Set<string>>(new Set());
  const [showCategoryAssignModal, setShowCategoryAssignModal] = useState(false);
  const [categoryAssignValue, setCategoryAssignValue] = useState('');

  // Cost Table expanded card state
  const [expandedCostManualId, setExpandedCostManualId] = useState<string | null>(null);

  // Multi-select for bulk download
  const [selectedManualsForDownload, setSelectedManualsForDownload] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  // Upload progress modal state
  const [showUploadProgressModal, setShowUploadProgressModal] = useState(false);

  // 업로드 후 링킹 리뷰 모달
  const [showLinkingReviewModal, setShowLinkingReviewModal] = useState(false);
  const [linkingReviewManuals, setLinkingReviewManuals] = useState<any[]>([]);
  const [linkingReviewEdits, setLinkingReviewEdits] = useState<Map<string, string>>(new Map()); // ingredientId -> newIngredientMasterId
  const [linkingReviewPriceEdits, setLinkingReviewPriceEdits] = useState<Map<string, number>>(new Map()); // manualId -> sellingPrice
  const [linkingReviewQuantityEdits, setLinkingReviewQuantityEdits] = useState<Map<string, { quantity: number; unit: string; manualIngredientId: string }>>(new Map()); // editKey -> quantity info
  const [linkingReviewLoading, setLinkingReviewLoading] = useState(false);
  const [masterIngredientsList, setMasterIngredientsList] = useState<any[]>([]); // 마스터 원재료 목록
  const [linkingSearchQueries, setLinkingSearchQueries] = useState<Map<string, string>>(new Map()); // editKey -> 검색어
  const [linkingSearchOpen, setLinkingSearchOpen] = useState<string | null>(null); // 열려있는 검색 드롭다운 editKey
  const [linkingReviewViewFilter, setLinkingReviewViewFilter] = useState<'all' | 'linked' | 'unlinked'>('all'); // 뷰 필터
  const [linkingReviewNewIngredients, setLinkingReviewNewIngredients] = useState<Map<string, any[]>>(new Map()); // manualId -> 추가된 새 식재료들
  const [showAddIngredientForManual, setShowAddIngredientForManual] = useState<string | null>(null); // 식재료 추가 드롭다운을 열어둘 manualId
  const [linkingReviewTemplateId, setLinkingReviewTemplateId] = useState<string>(''); // 현재 모달에서 사용 중인 템플릿 ID

  // 일괄 링킹 기능 (같은 이름 식재료 한번에 링킹)
  const [bulkLinkSearchTerm, setBulkLinkSearchTerm] = useState(''); // 일괄 링킹 검색어
  const [bulkLinkSelectedItems, setBulkLinkSelectedItems] = useState<Set<string>>(new Set()); // 선택된 아이템 editKey
  const [showBulkLinkMasterSelect, setShowBulkLinkMasterSelect] = useState(false); // 마스터 선택 드롭다운
  const [bulkLinkMasterSearchTerm, setBulkLinkMasterSearchTerm] = useState(''); // 마스터 검색어
  const [bulkLinkTargetMaster, setBulkLinkTargetMaster] = useState<any>(null); // 선택된 마스터
  
  // 일괄 판매가 설정 (모달 내)
  const [showBulkPriceInput, setShowBulkPriceInput] = useState(false); // 판매가 입력 드롭다운
  const [bulkPriceValue, setBulkPriceValue] = useState(''); // 일괄 설정할 판매가

  // 판매가 일괄 수정 모달
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkPriceEdits, setBulkPriceEdits] = useState<Map<string, number>>(new Map()); // manualId -> sellingPrice
  const [bulkPriceLoading, setBulkPriceLoading] = useState(false);
  
  // Cost Table inline 판매가 수정
  const [inlineEditingPriceId, setInlineEditingPriceId] = useState<string | null>(null);
  const [inlineEditPriceValue, setInlineEditPriceValue] = useState<string>('');

  // Upload target template selection (for uploading directly to a country)
  const [uploadTargetTemplateId, setUploadTargetTemplateId] = useState<string>('master'); // 'master' or template ID
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState({
    name: '',
    country: '',
    currency: 'USD',
    description: ''
  });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      
      // Load categories
      const categoriesRes = await fetch('/api/manuals/category', { cache: 'no-store' });
      if (categoriesRes.ok) {
        const cats = await categoriesRes.json();
        setCategories(cats);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Bulk assign category to selected manuals
  const handleBulkCategoryAssign = async () => {
    if (selectedManualsForCategory.size === 0) {
      alert('카테고리를 설정할 매뉴얼을 선택해주세요.');
      return;
    }
    
    try {
      const res = await fetch('/api/manuals/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualIds: Array.from(selectedManualsForCategory),
          category: categoryAssignValue || null
        })
      });
      
      if (res.ok) {
        const result = await res.json();
        alert(`${result.updated}개 매뉴얼의 카테고리가 설정되었습니다.`);
        setSelectedManualsForCategory(new Set());
        setShowCategoryAssignModal(false);
        setCategoryAssignValue('');
        fetchData(); // Refresh
      }
    } catch (error) {
      console.error('Failed to assign category:', error);
      alert('카테고리 설정 실패');
    }
  };

  // Create new price template (for upload modal)
  const handleCreateNewTemplate = async () => {
    if (!newTemplateForm.name || !newTemplateForm.country) {
      alert('템플릿 이름과 국가를 입력해주세요.');
      return;
    }
    
    try {
      const res = await fetch('/api/price-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateForm.name,
          country: newTemplateForm.country,
          currency: newTemplateForm.currency || 'USD',
          description: newTemplateForm.description,
          copyFromMaster: true
        })
      });
      
      if (res.ok) {
        const newTemplate = await res.json();
        // Add to templates list
        setPriceTemplates(prev => [...prev, newTemplate]);
        // Select the new template for upload
        setUploadTargetTemplateId(newTemplate.id);
        // Close modal and reset form
        setShowCreateTemplateModal(false);
        setNewTemplateForm({ name: '', country: '', currency: 'USD', description: '' });
        alert(`"${newTemplate.name}" 템플릿이 생성되었습니다!`);
      } else {
        const error = await res.json();
        alert(`템플릿 생성 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create template:', error);
      alert('템플릿 생성 중 오류가 발생했습니다.');
    }
  };

  // Update ingredient prices when template changes
  useEffect(() => {
    if (editorTemplateId && activeTab === 'editor') {
      updatePricesFromTemplate(editorTemplateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    console.log('🔍 Preview clicked for:', manual.id, manual.name);
    try {
      const res = await fetch(`/api/manuals/${manual.id}?includeIngredients=true&includeCostVersions=true`);
      console.log('🔍 Preview response status:', res.status);
      if (res.ok) {
        const fullManual = await res.json();
        console.log('🔍 Preview loaded:', fullManual.name, 'ingredients:', fullManual.ingredients?.length);
        setPreviewManual(fullManual);
        setShowPreviewModal(true);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('🔍 Preview failed:', res.status, errorData);
        alert(`미리보기 로드 실패: ${errorData.error || res.statusText}`);
      }
    } catch (error) {
      console.error('Failed to load manual:', error);
      alert('미리보기 로드 중 오류가 발생했습니다.');
    }
  };

  // Edit manual - load into editor
  const handleEditManual = async (manual: SavedManual) => {
    try {
      console.log('📝 Loading manual for edit:', manual.id);
      const res = await fetch(`/api/manuals/${manual.id}?includeIngredients=true`);
      if (res.ok) {
        const fullManual = await res.json();
        console.log('📝 Manual loaded:', fullManual.name, 'ingredients:', fullManual.ingredients?.length, 'cookingMethod:', fullManual.cookingMethod?.length);
        
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
          console.log('📝 Loading ingredients:', fullManual.ingredients);
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
        
        // Load cooking method - use actual saved data, or empty steps if none
        if (fullManual.cookingMethod) {
          const cookingData = typeof fullManual.cookingMethod === 'string' 
            ? JSON.parse(fullManual.cookingMethod) 
            : fullManual.cookingMethod;
          if (Array.isArray(cookingData) && cookingData.length > 0) {
            setCookingSteps(cookingData.map((step: any) => ({
              process: step.process || '',
              manual: step.manual || '',
              translatedManual: step.translatedManual || ''
            })));
          } else {
            setCookingSteps(Array(8).fill(null).map(() => ({ process: '', manual: '', translatedManual: '' })));
          }
        } else {
          setCookingSteps(Array(8).fill(null).map(() => ({ process: '', manual: '', translatedManual: '' })));
        }
        
        // Load price template ID
        setEditorTemplateId(fullManual.priceTemplateId || '');
        
        setEditingManualId(manual.id);
        setActiveTab('editor');
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Edit load failed:', res.status, errorData);
        alert(`수정 데이터 로드 실패: ${errorData.error || res.statusText}`);
      }
    } catch (error) {
      console.error('Failed to load manual for editing:', error);
      alert('수정 데이터 로드 중 오류가 발생했습니다.');
    }
  };

  // Delete manual (Soft Delete)
  const handleDeleteManual = async (manual: SavedManual) => {
    if (!confirm(`"${manual.name}" 매뉴얼을 삭제하시겠습니까? 휴지통으로 이동됩니다.`)) return;
    
    try {
      const res = await fetch(`/api/manuals/${manual.id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('매뉴얼이 휴지통으로 이동되었습니다.');
        // 즉시 UI에서 제거
        setSavedManuals(prev => prev.filter(m => m.id !== manual.id));
        // 백그라운드에서 데이터 새로고침
        await fetchData();
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

  // View version history
  const handleViewVersionHistory = async (manual: SavedManual) => {
    setIsLoadingVersions(true);
    setShowVersionModal(true);
    
    try {
      // 현재 매뉴얼의 상세 정보 먼저 가져오기 (ingredients 포함)
      const manualRes = await fetch(`/api/manuals/${manual.id}?includeIngredients=true`);
      if (manualRes.ok) {
        const fullManual = await manualRes.json();
        setSelectedVersionManual(fullManual);
      } else {
        setSelectedVersionManual(manual);
      }
      
      const res = await fetch(`/api/manuals/${manual.id}/versions`);
      const data = await res.json();
      setVersionHistory(data);
    } catch (error) {
      console.error('Error loading versions:', error);
      setSelectedVersionManual(manual);
      setVersionHistory({ versions: [], error: 'Failed to load version history' });
    } finally {
      setIsLoadingVersions(false);
    }
  };

  // Restore to a specific version
  const handleRestoreVersion = async (versionId: string) => {
    if (!selectedVersionManual) return;
    if (!confirm('이 버전으로 복구하시겠습니까? 현재 내용은 새로운 버전으로 저장됩니다.')) return;
    
    try {
      const res = await fetch(`/api/manuals/${selectedVersionManual.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`버전이 복구되었습니다. (새 버전: v${data.newVersion})`);
        setShowVersionModal(false);
        fetchData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('버전 복구 실패:', errorData);
        alert(`버전 복구 실패: ${errorData.error || errorData.details || res.statusText}`);
      }
    } catch (error) {
      console.error('Restore version error:', error);
      alert('버전 복구 중 오류가 발생했습니다.');
    }
  };

  // Hard Delete (Archive)
  const handleHardDelete = async (manual: SavedManual) => {
    const input = prompt("Archive로 이동하시려면 'ARCHIVE'를 대문자로 입력하세요.\n이 작업 후에는 일반 사용자는 볼 수 없게 되며 마스터 계정에서만 복구 가능합니다.");
    if (input !== 'ARCHIVE') return;

    try {
      const res = await fetch(`/api/manuals/${manual.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true, isActive: false })
      });
      
      if (res.ok) {
        alert('매뉴얼이 Archive로 이동되었습니다. 마스터 계정에서만 볼 수 있습니다.');
        fetchData();
      } else {
        alert('Archive 이동 실패');
      }
    } catch (error) {
      console.error('Archive move error:', error);
      alert('Archive 이동 중 오류가 발생했습니다.');
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

  // Bulk Permanent Delete (from Trash or Archive - Master/Admin only)
  const handleBulkPermanentDelete = async () => {
    if (selectedManualIds.size === 0) return;
    if (!isMaster) {
      alert('영구 삭제는 관리자만 가능합니다.');
      return;
    }
    if (!confirm(`⚠️ 경고: ${selectedManualIds.size}개 매뉴얼을 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 데이터가 영구적으로 삭제됩니다.`)) return;
    if (!confirm(`정말로 ${selectedManualIds.size}개 매뉴얼을 완전 삭제하시겠습니까?\n마지막 확인입니다.`)) return;

    try {
      const res = await fetch('/api/manuals/batch-permanent-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualIds: Array.from(selectedManualIds) })
      });
      
      if (res.ok) {
        const result = await res.json();
        alert(`완전 삭제 완료: ${result.totalDeleted}개 성공, ${result.totalFailed}개 실패`);
        setSelectedManualIds(new Set());
        fetchData();
      } else {
        const error = await res.json();
        alert(`완전 삭제 실패: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Bulk permanent delete error:', error);
      alert('일괄 완전 삭제 중 오류가 발생했습니다.');
    }
  };

  // Single Permanent Delete (Master/Admin only)
  const handlePermanentDelete = async (manual: SavedManual) => {
    if (!isMaster) {
      alert('영구 삭제는 관리자만 가능합니다.');
      return;
    }
    
    const input = prompt(`⚠️ 완전 삭제하시려면 'DELETE'를 대문자로 입력하세요.\n\n매뉴얼: ${manual.name}\n\n이 작업은 되돌릴 수 없습니다!`);
    if (input !== 'DELETE') return;

    try {
      const res = await fetch(`/api/manuals/${manual.id}/permanent-delete`, { method: 'DELETE' });
      
      if (res.ok) {
        alert('매뉴얼이 영구적으로 삭제되었습니다.');
        fetchData();
      } else {
        const error = await res.json();
        alert(`삭제 실패: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Permanent delete error:', error);
      alert('영구 삭제 중 오류가 발생했습니다.');
    }
  };

  // Download Excel
  const handleDownloadExcel = async (manual: SavedManual) => {
    console.log('📥 Download clicked for:', manual.id, manual.name);
    try {
      // Use export-template for proper BBQ template format
      const response = await fetch(`/api/manuals/${manual.id}/export-template`);
      console.log('📥 Download response status:', response.status);
      if (response.ok) {
        const blob = await response.blob();
        console.log('📥 Blob size:', blob.size);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${manual.name.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_Manual.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        const errorText = await response.text().catch(() => '');
        console.error('📥 Download failed:', response.status, errorText);
        alert(`Excel 다운로드 실패: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('Excel download error:', error);
      alert('Excel 다운로드 중 오류가 발생했습니다.');
    }
  };

  // Download multiple manuals as single Excel with multiple sheets
  const handleBulkDownloadManuals = async (manualIds: string[], options: { includeManual: boolean; includeCost: boolean } = { includeManual: true, includeCost: false }) => {
    if (manualIds.length === 0) {
      alert('다운로드할 매뉴얼을 선택해주세요.');
      return;
    }

    setIsBulkDownloading(true);
    try {
      const response = await fetch('/api/manuals/bulk-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          manualIds,
          includeManual: options.includeManual,
          includeCost: options.includeCost
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().split('T')[0];
        const suffix = options.includeManual && options.includeCost ? 'Manual_Cost' : options.includeCost ? 'Cost' : 'Manuals';
        a.download = `BBQ_${suffix}_${manualIds.length}items_${timestamp}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
        // Reset selection
        setSelectedManualsForDownload(new Set());
        setIsMultiSelectMode(false);
      } else {
        const errorText = await response.text().catch(() => '');
        alert(`다운로드 실패: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('Bulk download error:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsBulkDownloading(false);
    }
  };

  // Toggle multi-select mode
  const toggleMultiSelectMode = () => {
    if (isMultiSelectMode) {
      // Exiting multi-select mode - clear selections
      setSelectedManualsForDownload(new Set());
    }
    setIsMultiSelectMode(!isMultiSelectMode);
  };

  // Toggle manual selection for bulk download
  const toggleManualForDownload = (manualId: string) => {
    setSelectedManualsForDownload(prev => {
      const newSet = new Set(prev);
      if (newSet.has(manualId)) {
        newSet.delete(manualId);
      } else {
        newSet.add(manualId);
      }
      return newSet;
    });
  };

  // Select all visible manuals for download
  const selectAllManualsForDownload = (manuals: SavedManual[]) => {
    setSelectedManualsForDownload(new Set(manuals.map(m => m.id)));
  };

  // Clear manual selection for download
  const clearManualsForDownload = () => {
    setSelectedManualsForDownload(new Set());
  };

  // Clear editor form
  const clearEditorForm = () => {
    setMenuName('');
    setMenuNameKo('');
    setShelfLife('');
    setSellingPrice('');
    setIngredients([{ ...EMPTY_INGREDIENT }]);
    setCookingSteps(Array(8).fill(null).map(() => ({ process: '', manual: '', translatedManual: '' })));
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
        
        // Remember which tab we came from before clearing form
        const returnTab = editorTemplateId && editingManualId ? 'countryManuals' : 'manuals';
        
        // Reset form
        clearEditorForm();
        
        // Refresh data
        fetchData();
        setActiveTab(returnTab);
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

  // Client-side Excel parsing function - BBQ Chicken 매뉴얼 형식
  // ========================================
  // 마커 기반 동적 범위 파싱 (Anchor-based Dynamic Range Parsing)
  // ========================================
  // 
  // 📋 전체 파싱 규칙:
  // ┌─────────────────────────────────────────────────────────────────┐
  // │ 요소                │ 마커                 │ 값 위치              │
  // ├─────────────────────────────────────────────────────────────────┤
  // │ 1. 제목              │ NAME 행 - 1         │ 해당 행 첫 번째 셀    │
  // │ 2. Name/메뉴명       │ "Name" 셀           │ Name 오른쪽 셀       │
  // │ 3. Picture 라벨      │ "Picture" 셀        │ NAME 행 + 1          │
  // │ 4. Picture 영역      │ Picture ~ INGR_HDR  │ B~G열 영역           │
  // │ 5. Item List 라벨    │ "Item List" 셀      │ Picture 같은 행, H열 │
  // │ 6. Item List 데이터  │ ItemList ~ INGR_HDR │ H~I열               │
  // │ 7. Ingredients 라벨  │ "Ingredients Comp.."│ INGREDIENT_HEADER 행 │
  // │ 8. 식재료 헤더       │ NO+Weight+Unit 행   │ B~H열 헤더           │
  // │ 9. 식재료 데이터     │ INGR_HDR+1 ~ 1st BBQ│ 헤더와 같은 열       │
  // │ 10. BBQ CANADA      │ "BBQ CANADA" 텍스트  │ 페이지 구분자        │
  // │ 11. COOKING METHOD  │ BBQ_CANADA 다음 행   │ 조리법 제목          │
  // │ 12. PROCESS/MANUAL  │ PROCESS+MANUAL 행   │ A=PROCESS, D=MANUAL │
  // │ 13. 조리 단계        │ PROC_MAN+1 ~ 다음BBQ│ A=공정명, D=설명     │
  // └─────────────────────────────────────────────────────────────────┘
  //
  const parseManualSheet = (sheet: XLSX.WorkSheet, sheetName: string, shapeTexts: ShapeTextInfo[] = []): any | null => {
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (data.length < 10) return null;
    
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
    
    // 도형에서 프로세스명 추출 및 매칭
    const processLabelsFromShapes = shapeTexts.map(shape => {
      const matchResult = matchProcessPng(shape.text, DEFAULT_PROCESS_ASSET_INDEX);
      return {
        originalText: shape.text,
        matchedProcess: matchResult.canonical_label,
        pngFilename: matchResult.filename,
        row: shape.row,
        matchMethod: matchResult.method,
        matchScore: matchResult.score,
        needsVerification: matchResult.needs_verification
      };
    }).filter(p => p.matchScore > 0.5 || p.matchMethod !== 'default');
    
    console.log(`📍 Sheet "${sheetName}": Found ${processLabelsFromShapes.length} process labels from shapes:`, 
      processLabelsFromShapes.map(p => `${p.originalText} → ${p.matchedProcess} (${p.matchMethod})`));
    
    // === Step 1: 모든 마커 위치 찾기 ===
   interface Marker { 
     row: number; 
     type: string; 
     col?: number; 
     columnMap?: { noCol: number; ingredientCol: number; weightCol: number; unitCol: number; purchaseCol: number; };
   }
    const markers: Marker[] = [];
    
    for (let r = 0; r < data.length; r++) {
      const row = data[r] || [];
      const rowText = row.map(c => String(c ?? '').toLowerCase()).join(' ');
      const rowTextOriginal = row.map(c => String(c ?? '')).join(' ');
      
      // NAME 마커: "Name" 텍스트 (첫번째만)
      if (!markers.some(m => m.type === 'NAME')) {
        for (let c = 0; c < row.length; c++) {
          if (String(row[c] ?? '').trim().toLowerCase() === 'name') {
            markers.push({ row: r, type: 'NAME', col: c });
            break;
          }
        }
      }
      
      // PICTURE 마커: "Picture" 텍스트 (첫번째만)
      if (!markers.some(m => m.type === 'PICTURE')) {
        for (let c = 0; c < row.length; c++) {
          if (String(row[c] ?? '').trim().toLowerCase() === 'picture') {
            markers.push({ row: r, type: 'PICTURE', col: c });
            break;
          }
        }
      }
      
      // ITEM_LIST 마커: "Item List" 텍스트 (첫번째만)
      if (!markers.some(m => m.type === 'ITEM_LIST')) {
        for (let c = 0; c < row.length; c++) {
          if (String(row[c] ?? '').trim().toLowerCase() === 'item list') {
            markers.push({ row: r, type: 'ITEM_LIST', col: c });
            break;
          }
        }
      }
      
      // INGREDIENTS_COMPOSITION 마커: "Ingredients Composition" 텍스트
      if (!markers.some(m => m.type === 'INGREDIENTS_COMPOSITION')) {
        for (let c = 0; c < row.length; c++) {
          if (String(row[c] ?? '').toLowerCase().includes('ingredients composition')) {
            markers.push({ row: r, type: 'INGREDIENTS_COMPOSITION', col: c });
            break;
          }
        }
      }
      
      // INGREDIENT_HEADER: NO + Weight + Unit 가 있는 행 (열 위치 동적 감지)
      if (rowText.includes('no') && rowText.includes('weight') && rowText.includes('unit')) {
        if (!markers.some(m => m.type === 'INGREDIENT_HEADER')) {
          // 각 열의 실제 위치를 감지
          let noCol = -1, ingredientCol = -1, weightCol = -1, unitCol = -1, purchaseCol = -1;
          for (let c = 0; c < row.length; c++) {
            const cellText = String(row[c] ?? '').toLowerCase().trim();
            if (cellText === 'no' && noCol === -1) noCol = c;
            else if (cellText === 'ingredients' && ingredientCol === -1) ingredientCol = c;
            else if (cellText === 'weight' && weightCol === -1) weightCol = c;
            else if (cellText === 'unit' && unitCol === -1) unitCol = c;
            else if (cellText === 'purchase' && purchaseCol === -1) purchaseCol = c;
          }
          markers.push({ 
            row: r, 
            type: 'INGREDIENT_HEADER',
            columnMap: { noCol, ingredientCol, weightCol, unitCol, purchaseCol }
          });
        }
      }
      
      // BBQ_CANADA 마커 (여러 개 가능) - 페이지 구분자
      if (rowTextOriginal.includes('BBQ CANADA')) {
        markers.push({ row: r, type: 'BBQ_CANADA' });
      }
      
      // COOKING_METHOD 마커 (여러 개 가능)
      if (rowTextOriginal.includes('COOKING METHOD')) {
        markers.push({ row: r, type: 'COOKING_METHOD' });
      }
      
      // PROCESS_MANUAL 마커: PROCESS + MANUAL 가 있는 행 (여러 개 가능)
      if (rowText.includes('process') && rowText.includes('manual')) {
        markers.push({ row: r, type: 'PROCESS_MANUAL' });
      }
    }
    
    // === Step 2: 오프셋 계산 (NAME 기준) ===
    // 기본 위치: NAME은 A2 (row=1, col=0)
    const nameMarker = markers.find(m => m.type === 'NAME');
    let rowOffset = 0;
    let colOffset = 0;
    
    if (nameMarker && nameMarker.col !== undefined) {
      rowOffset = nameMarker.row - 1;  // 기본 row=1 대비 차이
      colOffset = nameMarker.col - 0;  // 기본 col=0 대비 차이
    }
    
    // === Step 3: 마커별 행/열 번호 추출 ===
    const pictureMarker = markers.find(m => m.type === 'PICTURE');
    const itemListMarker = markers.find(m => m.type === 'ITEM_LIST');
    const ingredientCompMarker = markers.find(m => m.type === 'INGREDIENTS_COMPOSITION');
    const ingredientHeaderMarker = markers.find(m => m.type === 'INGREDIENT_HEADER');
    const ingredientHeaderRow = ingredientHeaderMarker?.row ?? -1;
    const ingredientColumnMap = ingredientHeaderMarker?.columnMap ?? { noCol: -1, ingredientCol: -1, weightCol: -1, unitCol: -1, purchaseCol: -1 };
    const bbqCanadaRows = markers.filter(m => m.type === 'BBQ_CANADA').map(m => m.row);
    const cookingMethodRows = markers.filter(m => m.type === 'COOKING_METHOD').map(m => m.row);
    const processManualRows = markers.filter(m => m.type === 'PROCESS_MANUAL').map(m => m.row);
    
    // 범위 계산
    const firstBbqCanada = bbqCanadaRows[0] ?? data.length;
    const secondBbqCanada = bbqCanadaRows[1] ?? data.length;
    const thirdBbqCanada = bbqCanadaRows[2] ?? data.length;
    
    // === Step 4: 기본 정보 파싱 ===
    let title = '';           // Manual(Kitchen)
    let name = '';            // 메뉴명
    let koreanName = '';
    let sellingPrice: number | undefined;
    let pictureInfo: any = null;
    let itemListInfo: any = null;
    const ingredients: any[] = [];
    const cookingMethod: CookingStep[] = [];
    
    // 4-1. Title 파싱: NAME 행 - 1
    if (nameMarker) {
      const titleRow = nameMarker.row - 1;
      if (titleRow >= 0) {
        const row = data[titleRow] || [];
        for (const cell of row) {
          if (cell !== undefined && cell !== null && String(cell).trim() !== '') {
            title = String(cell).trim();
            break;
          }
        }
      }
    }
    
    // 4-2. Name 파싱: NAME 마커 오른쪽 셀
    if (nameMarker) {
      const nameRow = data[nameMarker.row] || [];
      const nameValueCol = (nameMarker.col ?? 0) + 1;
      name = String(nameRow[nameValueCol] ?? '').trim();
    }
    if (!name) name = sheetName.replace(/^\d+\./, '').trim();
    koreanName = name;
    
    // 4-3. Picture 정보: PICTURE 마커 행 ~ INGREDIENT_HEADER 행 - 1
    if (pictureMarker && ingredientHeaderRow > pictureMarker.row) {
      pictureInfo = {
        labelRow: pictureMarker.row,
        labelCol: pictureMarker.col,
        startRow: pictureMarker.row,
        endRow: ingredientHeaderRow - 1,
        // 이미지 영역: B~G열 (col 1~6 + colOffset)
        imageStartCol: 1 + colOffset,
        imageEndCol: 6 + colOffset
      };
    }
    
    // 4-4. Item List 정보: ITEM_LIST 마커 행 ~ INGREDIENT_HEADER 행 - 1
    if (itemListMarker && ingredientHeaderRow > itemListMarker.row) {
      itemListInfo = {
        labelRow: itemListMarker.row,
        labelCol: itemListMarker.col,
        startRow: itemListMarker.row + 1,
        endRow: ingredientHeaderRow - 1,
        // Item List 영역: H~I열 (col 7~8 + colOffset)
        dataStartCol: 7 + colOffset,
        dataEndCol: 8 + colOffset
      };
    }
    
    console.log(`📋 Sheet "${sheetName}": offset(row+${rowOffset}, col+${colOffset}), ` +
                `title="${title}", name="${name}", ` +
                `picture=${pictureMarker?.row ?? 'N/A'}~${ingredientHeaderRow - 1}, ` +
                `ingredients=${ingredientHeaderRow + 1}~${firstBbqCanada}, ` +
                `cooking=${processManualRows[0] ?? 'N/A'}~${secondBbqCanada}`);
    
    // === Step 5: 식재료 파싱 (INGREDIENT_HEADER+1 ~ 첫번째 BBQ_CANADA-1) ===
    if (ingredientHeaderRow >= 0 && firstBbqCanada > ingredientHeaderRow) {
      const startRow = ingredientHeaderRow + 1;
      const endRow = firstBbqCanada - 1;
      
      // 동적으로 감지된 열 위치 사용, 없으면 기본값 사용
      const { noCol: detectedNoCol, ingredientCol: detectedIngredientCol, weightCol: detectedWeightCol, unitCol: detectedUnitCol, purchaseCol: detectedPurchaseCol } = ingredientColumnMap;
      
      for (let r = startRow; r <= endRow; r++) {
        const row = data[r] || [];
        
        // NO 열 (동적 감지 또는 기본값)
        const noCol = detectedNoCol >= 0 ? detectedNoCol : 1 + colOffset;
        const no = row[noCol];
        if (no === undefined || no === null || no === '') continue;
        
        // Ingredients 열 (동적 감지 또는 기본값)
        const nameCol = detectedIngredientCol >= 0 ? detectedIngredientCol : 2 + colOffset;
        let ingredientName = String(row[nameCol] ?? '').trim();
        // Ingredients 열이 비어있으면 다음 열 시도
        if (!ingredientName && row[nameCol + 1]) ingredientName = String(row[nameCol + 1]).trim();
        if (!ingredientName) continue;
        if (ingredientName.toLowerCase() === 'ingredients') continue;
        
        // Weight 열 (동적 감지 또는 기본값)
        const weightCol = detectedWeightCol >= 0 ? detectedWeightCol : 4 + colOffset;
        const weightVal = row[weightCol];
        let weight = typeof weightVal === 'number' ? weightVal : parseFloat(String(weightVal ?? '').replace(/[^0-9.]/g, ''));
        if (isNaN(weight)) weight = 0;
        
        // Unit 열 (동적 감지 또는 기본값)
        const unitCol = detectedUnitCol >= 0 ? detectedUnitCol : 5 + colOffset;
        let unit = String(row[unitCol] ?? 'g').trim();
        if (!unit || unit.toLowerCase() === 'null') unit = 'g';
        
        // Purchase 열 (동적 감지 또는 기본값)
        const purchaseCol = detectedPurchaseCol >= 0 ? detectedPurchaseCol : 6 + colOffset;
        let purchase = String(row[purchaseCol] ?? 'Local').trim();
        if (!purchase) purchase = 'Local';
        
        // Others 열 (Purchase 다음 열)
        const othersCol = purchaseCol + 1;
        const others = String(row[othersCol] ?? '').trim();
        
        ingredients.push({
          no: typeof no === 'number' ? no : parseInt(String(no)) || ingredients.length + 1,
          name: ingredientName,
          koreanName: ingredientName,
          quantity: weight,
          weight: weight,
          unit,
          purchase,
          others
        });
      }
    }
    
    // === Step 6: 조리법 파싱 (PROCESS_MANUAL+1 ~ 다음 BBQ_CANADA-1) ===
    // 빈 행을 기준으로 프로세스를 구분함
    // 빈 행이 오면 그 다음 행부터 새로운 프로세스 시작
    const processCol = 0 + colOffset;  // PROCESS 열 (A열 기준)
    const manualCol = 3 + colOffset;   // MANUAL 열 (D열 기준)
    
    // 각 PROCESS_MANUAL 마커에 대해 다음 BBQ_CANADA까지 파싱
    for (let i = 0; i < processManualRows.length; i++) {
      const startRow = processManualRows[i] + 1;
      const endRow = (i === 0 ? secondBbqCanada : thirdBbqCanada) - 1;
      
      if (startRow >= endRow) continue;
      
      let processIndex = cookingMethod.length; // 프로세스 인덱스 (0-based)
      let currentManualLines: string[] = [];
      let lastRowWasEmpty = true; // 시작 시 새 프로세스로 간주
      
      for (let r = startRow; r <= endRow; r++) {
        const row = data[r] || [];
        
        // Get process name (PROCESS 열) - A열에 값이 있으면 그걸 사용
        const processName = String(row[processCol] ?? '').trim();
        
        // Get manual text (MANUAL 열)
        let manualText = String(row[manualCol] ?? '').trim();
        
        // 현재 행이 빈 행인지 확인 (A열과 D열 모두 비어있으면 빈 행)
        const isEmptyRow = !processName && !manualText;
        
        if (isEmptyRow) {
          // 빈 행: 현재까지의 프로세스 저장하고 빈 행 플래그 설정
          if (currentManualLines.length > 0) {
            // 도형에서 추출한 프로세스명 사용 (순서대로)
            const shapeProcess = processLabelsFromShapes[processIndex];
            const processLabel = shapeProcess 
              ? shapeProcess.matchedProcess 
              : `Process ${processIndex + 1}`;
            const pngFilename = shapeProcess?.pngFilename || null;
            
            cookingMethod.push({
              process: processLabel,
              manual: currentManualLines.join('\n'),
              translatedManual: '',
              pngFilename, // PNG 파일명 추가
              processMatchInfo: shapeProcess ? {
                originalText: shapeProcess.originalText,
                matchMethod: shapeProcess.matchMethod,
                matchScore: shapeProcess.matchScore,
                needsVerification: shapeProcess.needsVerification
              } : null
            });
            processIndex++;
            currentManualLines = [];
          }
          lastRowWasEmpty = true;
        } else {
          // 데이터가 있는 행
          // A열에 프로세스명이 명시적으로 있으면 그것을 사용
          // 빈 행 직후의 첫 데이터 행은 새 프로세스 시작
          
          if (manualText) {
            const cleanLine = manualText.replace(/^[▶\-•]\s*/, '').trim();
            if (cleanLine.length > 0) {
              currentManualLines.push('▶' + cleanLine);
            }
          }
          
          lastRowWasEmpty = false;
        }
      }
      
      // 페이지 끝에서 남은 프로세스 저장
      if (currentManualLines.length > 0) {
        const shapeProcess = processLabelsFromShapes[processIndex];
        const processLabel = shapeProcess 
          ? shapeProcess.matchedProcess 
          : `Process ${processIndex + 1}`;
        const pngFilename = shapeProcess?.pngFilename || null;
        
        cookingMethod.push({
          process: processLabel,
          manual: currentManualLines.join('\n'),
          translatedManual: '',
          pngFilename,
          processMatchInfo: shapeProcess ? {
            originalText: shapeProcess.originalText,
            matchMethod: shapeProcess.matchMethod,
            matchScore: shapeProcess.matchScore,
            needsVerification: shapeProcess.needsVerification
          } : null
        });
      }
    }
    
    // === Step 7: 결과 반환 ===
    if (!name && ingredients.length === 0 && cookingMethod.length === 0) {
      return null;
    }
    
    console.log(`✅ Parsed "${sheetName}": ${ingredients.length} ingredients, ${cookingMethod.length} cooking steps`);
    
    return {
      name,
      koreanName,
      sellingPrice,
      ingredients,
      cookingMethod,
      hasLinkingIssue: false,
      // 전체 시트 정보 (미리보기 및 디버깅용)
      _sheetInfo: {
        title,                    // Manual(Kitchen)
        rowOffset,
        colOffset,
        pictureInfo,              // Picture 영역 정보
        itemListInfo,             // Item List 영역 정보
        ingredientHeaderRow: ingredientHeaderRow + 1,
        firstBbqCanadaRow: firstBbqCanada + 1,
        cookingMethodRows: cookingMethodRows.map(r => r + 1),
        processManualRows: processManualRows.map(r => r + 1),
        bbqCanadaRows: bbqCanadaRows.map(r => r + 1),
        markers: markers.map(m => ({ type: m.type, row: m.row + 1, col: m.col }))
      }
    };
  };

  // Process Excel file - shared logic for file select and drag & drop
  const processExcelFile = async (file: File) => {
    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`📂 Selected file: ${file.name} (${fileSizeMB.toFixed(1)}MB)`);
    
    setExcelFile(file);
    setIsUploading(true);
    
    try {
      // Always parse client-side for reliability
      console.log('📊 Parsing Excel client-side...');
      const buffer = await file.arrayBuffer();
      
      // 0. 이미지 추출 (JSZip 사용)
      console.log('📷 Extracting images from Excel...');
      let sheetImagesMap: Map<string, string> = new Map();
      try {
        sheetImagesMap = await extractImagesFromExcel(buffer);
        console.log(`✅ Extracted ${sheetImagesMap.size} sheet images`);
      } catch (imageError) {
        console.warn('⚠️ Could not extract images:', imageError);
      }
      
      // 1. 도형 텍스트 추출 (프로세스명이 도형에 저장되어 있음)
      console.log('🔍 Extracting shape texts from Excel...');
      let shapesBySheet: Map<number, ShapeTextInfo[]> = new Map();
      try {
        shapesBySheet = await extractShapeTextsFromExcel(buffer);
        console.log(`✅ Found shapes in ${shapesBySheet.size} sheets`);
        shapesBySheet.forEach((shapes, sheetIdx) => {
          console.log(`  Sheet ${sheetIdx}: ${shapes.map(s => s.text).join(', ')}`);
        });
      } catch (shapeError) {
        console.warn('⚠️ Could not extract shape texts:', shapeError);
      }
      
      // 2. 기본 엑셀 데이터 파싱
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      console.log(`📋 Found ${workbook.SheetNames.length} sheets`);
      
      const allManuals: any[] = [];
      for (let sheetIdx = 0; sheetIdx < workbook.SheetNames.length; sheetIdx++) {
        const sheetName = workbook.SheetNames[sheetIdx];
        const sheet = workbook.Sheets[sheetName];
        // 시트 인덱스에 해당하는 도형 텍스트 가져오기 (1-based index)
        const sheetShapes = shapesBySheet.get(sheetIdx + 1) || [];
        const manual = parseManualSheet(sheet, sheetName, sheetShapes);
        if (manual) {
          // 이미지 첨부 (시트 이름 기준)
          const imageData = sheetImagesMap.get(sheetName);
          if (imageData) {
            manual.imageData = imageData;
            console.log(`📷 Attached image to manual: ${manual.name}`);
          }
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

  // Excel file upload - for input element
  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processExcelFile(file);
  };

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    
    const file = files[0];
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.');
      return;
    }
    
    await processExcelFile(file);
  };

  // Upload manuals in chunks
  const uploadChunk = async (manuals: any[], startIdx: number, chunkSize: number = 10) => {
    const chunk = manuals.slice(startIdx, startIdx + chunkSize);
    if (chunk.length === 0) return { success: true, count: 0, errors: [] };
    
    console.log(`📤 Uploading chunk of ${chunk.length} manuals starting at index ${startIdx}`);
    
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
      throw new Error(error.error || error.details || 'Upload failed');
    }
    
    const data = await res.json();
    console.log(`✅ Chunk uploaded: ${data.importedCount} manuals created`, data.errors || []);
    return { success: true, count: data.importedCount, errors: data.errors || [] };
  };

  // Chunked upload with confirmation
  const handleChunkedUpload = async () => {
    if (pendingManuals.length === 0) return;
    
    const CHUNK_SIZE = 10;
    let currentIdx = chunkProgress?.saved || 0;
    const total = pendingManuals.length;
    let totalSaved = 0;
    
    setIsUploading(true);
    
    try {
      while (currentIdx < total) {
        // Calculate chunk size for this iteration
        const chunkEnd = Math.min(currentIdx + CHUNK_SIZE, total);
        const chunkSize = chunkEnd - currentIdx;
        
        // Upload one chunk
        const result = await uploadChunk(pendingManuals, currentIdx, CHUNK_SIZE);
        
        // Use actual imported count, but fallback to chunk size if API returns 0
        const savedInChunk = result.count > 0 ? result.count : chunkSize;
        totalSaved += savedInChunk;
        
        // Always advance by chunk size to prevent infinite loop
        currentIdx = chunkEnd;
        
        setChunkProgress({ current: currentIdx, total, saved: totalSaved });
        
        const remaining = total - currentIdx;
        
        if (remaining > 0) {
          // Ask user to continue
          const continueUpload = confirm(
            `✅ ${totalSaved}개 저장 완료!\n\n남은 매뉴얼: ${remaining}개\n\n계속 진행하시겠습니까?`
          );
          
          if (!continueUpload) {
            alert(`업로드 중단됨.\n\n저장 완료: ${totalSaved}개\n미저장: ${remaining}개`);
            break;
          }
        }
      }
      
      if (currentIdx >= total) {
        alert(`✅ 모든 매뉴얼 업로드 완료!\n\n총 ${totalSaved}개 매뉴얼이 저장되었습니다.`);
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

  // Import Excel manuals (only confirmed ones) - with batch processing for large uploads
  const handleExcelImport = async () => {
    if (!excelFile || !excelPreviewData?.allManuals || excelConfirmedManuals.size === 0) return;
    
    // Get only confirmed manuals
    const confirmedManualData = excelPreviewData.allManuals.filter((_: any, idx: number) => 
      excelConfirmedManuals.has(idx)
    );
    
    // Determine if uploading to a specific country template
    const isCountryUpload = uploadTargetTemplateId !== 'master';
    const targetTemplate = isCountryUpload ? priceTemplates.find(t => t.id === uploadTargetTemplateId) : null;
    
    setIsUploading(true);
    setChunkProgress({ current: 0, total: confirmedManualData.length, saved: 0 });
    setShowUploadProgressModal(true); // Show progress modal
    
    // Process 1 manual at a time to avoid payload size limits
    let totalImported = 0;
    let totalLinked = 0;
    const errors: string[] = [];
    
    try {
      // Process one by one
      for (let i = 0; i < confirmedManualData.length; i++) {
        const manual = confirmedManualData[i];
        
        // Update progress
        setChunkProgress({ current: i + 1, total: confirmedManualData.length, saved: totalImported });
        
        console.log(`📦 Uploading ${i + 1}/${confirmedManualData.length}: ${manual?.name || 'unknown'}${isCountryUpload ? ` → ${targetTemplate?.name}` : ''}`);
        
        // Compress image data if too large (limit to 300KB per image)
        const compressedManual = { ...manual };
        if (compressedManual.imageData && compressedManual.imageData.length > 300000) {
          console.log(`🗜️ Image too large (${Math.round(compressedManual.imageData.length / 1024)}KB), removing...`);
          delete compressedManual.imageData;
        }
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 second timeout
          
          // Build request body - include template info if uploading to country
          const requestBody: any = {
            importMode: 'import-direct',
            manuals: [compressedManual]
          };
          
          // If uploading to a country template, set flags
          if (isCountryUpload && targetTemplate) {
            requestBody.priceTemplateId = targetTemplate.id;
            requestBody.isMaster = false;
          }
          
          const res = await fetch('/api/manuals/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (res.ok) {
            const data = await res.json();
            totalImported += data.importedCount || 0;
            totalLinked += data.linkedIngredients || 0;
            if (data.errors && data.errors.length > 0) {
              errors.push(...data.errors);
            }
          } else {
            let errorMsg = 'Unknown error';
            try {
              const errorData = await res.json();
              errorMsg = errorData.error || errorData.details || `HTTP ${res.status}`;
            } catch {
              errorMsg = `HTTP ${res.status}: ${res.statusText}`;
            }
            console.error(`❌ Failed: ${manual?.name}: ${errorMsg}`);
            errors.push(`${manual?.name || i + 1}: ${errorMsg}`);
          }
        } catch (fetchError: any) {
          const errorMsg = fetchError?.name === 'AbortError' ? 'Timeout' : (fetchError?.message || 'Network error');
          console.error(`❌ Error for ${manual?.name}:`, errorMsg);
          errors.push(`${manual?.name || i + 1}: ${errorMsg}`);
        }
        
        // Small delay between requests to avoid rate limiting
        if (i < confirmedManualData.length - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
      
      // Final progress update
      setChunkProgress({ current: confirmedManualData.length, total: confirmedManualData.length, saved: totalImported });
      
      // Show results
      const templateInfo = isCountryUpload && targetTemplate ? `\n📍 ${targetTemplate.name} 템플릿에 저장됨` : '';
      const linkedInfo = totalLinked > 0 ? `\n🔗 ${totalLinked}개 식재료 자동 링킹됨` : '';
      const errorInfo = errors.length > 0 ? `\n⚠️ ${errors.length}개 오류 발생` : '';
      
      if (totalImported > 0) {
        // 업로드 성공 - 모달 닫고 데이터 새로고침
        setShowExcelUploadModal(false);
        setExcelFile(null);
        setExcelPreviewData(null);
        setExcelConfirmedManuals(new Set());
        setExcelPreviewIndex(0);
        
        // 업로드에 사용한 템플릿 ID 저장 (리셋 전에)
        const uploadedTemplateId = uploadTargetTemplateId;
        setUploadTargetTemplateId('master'); // Reset to master
        
        // 데이터 새로고침 후 링킹 리뷰 모달 열기
        await fetchData();
        
        // 링킹 리뷰 모달 열기 제안
        const openReview = confirm(
          `✅ ${totalImported}개 매뉴얼이 가져오기 되었습니다.${templateInfo}${linkedInfo}${errorInfo}\n\n` +
          `전체 식재료 링킹 상태를 확인/수정하시겠습니까?`
        );
        
        if (openReview) {
          // 업로드된 템플릿 ID로 editorTemplateId 설정 후 모달 열기
          // 상태 설정과 동시에 인자로 직접 전달하여 상태 업데이트 지연 문제 방지
          const templateIdForModal = uploadedTemplateId !== 'master' ? uploadedTemplateId : '';
          if (uploadedTemplateId !== 'master') {
            setEditorTemplateId(uploadedTemplateId);
          } else {
            setEditorTemplateId('');
          }
          await openLinkingReviewModal(templateIdForModal);
        }
      } else {
        const firstErrors = errors.slice(0, 3).join('\n');
        alert(`업로드 실패: ${errors.length}개 오류\n\n${firstErrors}${errors.length > 3 ? `\n... 외 ${errors.length - 3}개` : ''}`);
      }
    } catch (error: any) {
      console.error('Excel import error:', error);
      alert(`가져오기 중 오류가 발생했습니다: ${error?.message || 'Unknown error'}\n\n저장 완료: ${totalImported}개`);
    } finally {
      setIsUploading(false);
      setChunkProgress(null);
      setShowUploadProgressModal(false); // Hide progress modal
    }
  };

  // 링킹 리뷰 모달 열기 - 선택된 템플릿의 매뉴얼과 식재료 로드
  // overrideTemplateId: 업로드 직후처럼 상태가 아직 업데이트되지 않았을 때 템플릿 ID를 직접 전달
  const openLinkingReviewModal = async (overrideTemplateId?: string) => {
    setLinkingReviewLoading(true);
    setShowLinkingReviewModal(true);
    
    try {
      // 인자로 받은 템플릿 ID가 있으면 사용, 없으면 현재 상태에서 결정
      let currentTemplateId: string;
      if (overrideTemplateId !== undefined) {
        currentTemplateId = overrideTemplateId;
      } else if (activeTab === 'countryManuals') {
        currentTemplateId = countryFilterTemplateId;
      } else {
        currentTemplateId = editorTemplateId;
      }
      
      // 모달에서 사용할 템플릿 ID 저장
      setLinkingReviewTemplateId(currentTemplateId);
      
      const isMaster = !currentTemplateId || currentTemplateId === 'master' || currentTemplateId === '' || currentTemplateId === '__select__';
      
      console.log('🔗 Opening linking review modal, templateId:', currentTemplateId, 'isMaster:', isMaster);
      
      // 선택된 템플릿의 매뉴얼만 필터링
      const filteredManuals = savedManuals.filter(manual => {
        if (isMaster) {
          // 마스터 선택 시: isMaster=true이거나 priceTemplateId가 없는 것
          return (manual as any).isMaster === true || (manual as any).isMaster === 1 || !(manual as any).priceTemplateId;
        } else {
          // 특정 템플릿 선택 시: 해당 템플릿에 연결된 매뉴얼만
          return (manual as any).priceTemplateId === currentTemplateId;
        }
      });
      
      console.log('🔗 Filtered manuals count:', filteredManuals.length, 'of total:', savedManuals.length);
      
      // 필터링된 매뉴얼의 상세 정보 가져오기
      const manualsWithIngredients = [];
      
      for (const manual of filteredManuals) {
        try {
          const res = await fetch(`/api/manuals/${manual.id}`);
          if (res.ok) {
            const data = await res.json();
            manualsWithIngredients.push(data);
          }
        } catch (err) {
          console.warn(`Failed to load manual ${manual.id}`);
        }
      }
      
      console.log('🔗 Loaded manuals with ingredients:', manualsWithIngredients.length);
      setLinkingReviewManuals(manualsWithIngredients);
      
      // 템플릿에 해당하는 원재료 목록 로드
      // 마스터인 경우 전체 원재료, 국가 템플릿인 경우 해당 템플릿 아이템
      let ingredientsUrl = '/api/ingredients?limit=500';
      if (!isMaster && currentTemplateId) {
        ingredientsUrl = `/api/ingredients?priceTemplateId=${currentTemplateId}&limit=500`;
      }
      
      const ingredientsRes = await fetch(ingredientsUrl);
      if (ingredientsRes.ok) {
        const ingredients = await ingredientsRes.json();
        setMasterIngredientsList(ingredients);
      }
    } catch (error) {
      console.error('Failed to load linking review data:', error);
    } finally {
      setLinkingReviewLoading(false);
    }
  };

  // 선택된 매뉴얼만 링킹 리뷰 모달에 표시
  const openLinkingReviewModalWithSelected = async (manualIds: string[]) => {
    setLinkingReviewLoading(true);
    setShowLinkingReviewModal(true);
    
    try {
      console.log('🔗 Opening linking review modal for selected manuals:', manualIds.length);
      
      // 선택된 매뉴얼의 상세 정보 가져오기
      const manualsWithIngredients = [];
      
      for (const manualId of manualIds) {
        try {
          const res = await fetch(`/api/manuals/${manualId}`);
          if (res.ok) {
            const data = await res.json();
            manualsWithIngredients.push(data);
          }
        } catch (err) {
          console.warn(`Failed to load manual ${manualId}`);
        }
      }
      
      console.log('🔗 Loaded selected manuals with ingredients:', manualsWithIngredients.length);
      setLinkingReviewManuals(manualsWithIngredients);
      
      // 현재 템플릿의 원재료 목록 로드
      const currentTemplateId = countryFilterTemplateId;
      
      // 모달에서 사용할 템플릿 ID 저장
      setLinkingReviewTemplateId(currentTemplateId);
      
      const isMaster = !currentTemplateId || currentTemplateId === 'master' || currentTemplateId === '' || currentTemplateId === '__select__';
      
      let ingredientsUrl = '/api/ingredients?limit=500';
      if (!isMaster && currentTemplateId) {
        ingredientsUrl = `/api/ingredients?priceTemplateId=${currentTemplateId}&limit=500`;
      }
      
      const ingredientsRes = await fetch(ingredientsUrl);
      if (ingredientsRes.ok) {
        const ingredients = await ingredientsRes.json();
        setMasterIngredientsList(ingredients);
      }
    } catch (error) {
      console.error('Failed to load linking review data:', error);
    } finally {
      setLinkingReviewLoading(false);
    }
  };

  // 링킹 변경사항 저장
  const saveLinkingReviewChanges = async () => {
    // 새 식재료 수 계산
    let newIngCount = 0;
    linkingReviewNewIngredients.forEach(arr => { newIngCount += arr.length; });
    
    if (linkingReviewEdits.size === 0 && linkingReviewPriceEdits.size === 0 && linkingReviewQuantityEdits.size === 0 && newIngCount === 0) {
      setShowLinkingReviewModal(false);
      return;
    }

    setLinkingReviewLoading(true);
    let linkSuccessCount = 0;
    let linkErrorCount = 0;
    let priceSuccessCount = 0;
    let priceErrorCount = 0;
    let quantitySuccessCount = 0;
    let quantityErrorCount = 0;
    let newIngSuccessCount = 0;
    let newIngErrorCount = 0;

    try {
      // 1. 링킹 변경사항 저장
      for (const [editKey, newMasterId] of linkingReviewEdits) {
        try {
          const [manualId] = editKey.split('_');
          const manual = linkingReviewManuals.find(m => m.id === manualId);
          if (!manual) continue;

          const ingredientIndex = parseInt(editKey.split('_')[1]);
          const ingredient = manual.ingredients?.[ingredientIndex];
          if (!ingredient) continue;

          // 마스터 식재료의 가격 정보 가져오기
          const linkedMaster = newMasterId ? masterIngredientsList.find(m => m.id === newMasterId) : null;
          const unitPrice = linkedMaster?.unitPrice || null;
          const baseQuantity = linkedMaster?.baseQuantity || linkedMaster?.quantity || null;

          const res = await fetch(`/api/ingredients/auto-link`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              manualIngredientId: ingredient.id,
              newIngredientMasterId: newMasterId || null,
              unitPrice,
              baseQuantity
            })
          });

          if (res.ok) linkSuccessCount++;
          else linkErrorCount++;
        } catch (err) {
          linkErrorCount++;
        }
      }

      // 2. 판매가 변경사항 저장
      for (const [manualId, sellingPrice] of linkingReviewPriceEdits) {
        try {
          const res = await fetch(`/api/manuals/${manualId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sellingPrice })
          });

          if (res.ok) priceSuccessCount++;
          else priceErrorCount++;
        } catch (err) {
          priceErrorCount++;
        }
      }

      // 3. 사용량 변경사항 저장
      for (const [editKey, quantityInfo] of linkingReviewQuantityEdits) {
        try {
          const res = await fetch(`/api/ingredients/auto-link`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              manualIngredientId: quantityInfo.manualIngredientId,
              quantity: quantityInfo.quantity,
              unit: quantityInfo.unit,
              updateType: 'quantity'
            })
          });

          if (res.ok) quantitySuccessCount++;
          else quantityErrorCount++;
        } catch (err) {
          quantityErrorCount++;
        }
      }

      // 4. 새 식재료 추가
      for (const [manualId, newIngs] of linkingReviewNewIngredients) {
        for (const newIng of newIngs) {
          try {
            const res = await fetch(`/api/manuals/${manualId}/ingredients`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: newIng.name,
                koreanName: newIng.koreanName,
                quantity: newIng.quantity,
                unit: newIng.unit,
                ingredientId: newIng.ingredientId || null
              })
            });

            if (res.ok) newIngSuccessCount++;
            else newIngErrorCount++;
          } catch (err) {
            newIngErrorCount++;
          }
        }
      }

      const linkMsg = linkSuccessCount > 0 ? `🔗 ${linkSuccessCount}개 링킹` : '';
      const priceMsg = priceSuccessCount > 0 ? `💰 ${priceSuccessCount}개 판매가` : '';
      const quantityMsg = quantitySuccessCount > 0 ? `📦 ${quantitySuccessCount}개 사용량` : '';
      const newIngMsg = newIngSuccessCount > 0 ? `➕ ${newIngSuccessCount}개 새 식재료` : '';
      const allMsgs = [linkMsg, priceMsg, quantityMsg, newIngMsg].filter(m => m).join(', ');
      const totalErrors = linkErrorCount + priceErrorCount + quantityErrorCount + newIngErrorCount;
      const errorMsg = totalErrors > 0 ? ` (${totalErrors}개 실패)` : '';
      
      alert(`✅ 저장 완료!\n${allMsgs} 업데이트${errorMsg}`);
      setLinkingReviewEdits(new Map());
      setLinkingReviewPriceEdits(new Map());
      setLinkingReviewQuantityEdits(new Map());
      setLinkingReviewNewIngredients(new Map());
      
      // 데이터 새로고침 (모달은 닫지 않음)
      await openLinkingReviewModal();
      fetchData();
    } catch (error) {
      console.error('Failed to save changes:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setLinkingReviewLoading(false);
    }
  };

  // 판매가 일괄 수정 저장
  const saveBulkPriceChanges = async () => {
    if (bulkPriceEdits.size === 0) {
      setShowBulkPriceModal(false);
      return;
    }

    setBulkPriceLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const [manualId, sellingPrice] of bulkPriceEdits) {
        try {
          const res = await fetch(`/api/manuals/${manualId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sellingPrice })
          });

          if (res.ok) successCount++;
          else errorCount++;
        } catch (err) {
          errorCount++;
        }
      }

      alert(`✅ ${successCount}개 판매가가 업데이트되었습니다.${errorCount > 0 ? ` (${errorCount}개 실패)` : ''}`);
      setBulkPriceEdits(new Map());
      setShowBulkPriceModal(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save bulk prices:', error);
      alert('판매가 저장 중 오류가 발생했습니다.');
    } finally {
      setBulkPriceLoading(false);
    }
  };

  // Cost Table inline 판매가 저장
  const saveInlinePrice = async (manualId: string, newPrice: number) => {
    try {
      const res = await fetch(`/api/manuals/${manualId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellingPrice: newPrice })
      });
      
      if (res.ok) {
        // Update local state without full refetch
        setSavedManuals(prev => prev.map(m => 
          m.id === manualId ? { ...m, sellingPrice: newPrice } : m
        ));
        setInlineEditingPriceId(null);
        setInlineEditPriceValue('');
      } else {
        alert('판매가 저장 실패');
      }
    } catch (error) {
      console.error('Failed to save inline price:', error);
      alert('판매가 저장 중 오류가 발생했습니다.');
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

    // Filter by Active/Trash/Archive tab
    // Active: isActive=true (default state)
    // Trash: isActive=false AND isArchived=false (soft deleted)
    // Archive: isArchived=true (hard deleted, master admin only)
    if (activeTab === 'trash') {
      // Show soft deleted manuals (Trash)
      filtered = filtered.filter(m => {
        const isActive = (m as any).isActive;
        const isArchived = (m as any).isArchived;
        return (isActive === false || isActive === 0) && (isArchived === false || isArchived === 0 || !isArchived);
      });
      // Apply search filter
      if (trashSearch) {
        filtered = filtered.filter(m => 
          m.name?.toLowerCase().includes(trashSearch.toLowerCase()) ||
          m.koreanName?.toLowerCase().includes(trashSearch.toLowerCase())
        );
      }
    } else if (activeTab === 'archived') {
      // Show archived manuals (hard deleted, master admin only)
      filtered = filtered.filter(m => !!(m as any).isArchived);
      // Apply search filter
      if (archiveSearch) {
        filtered = filtered.filter(m => 
          m.name?.toLowerCase().includes(archiveSearch.toLowerCase()) ||
          m.koreanName?.toLowerCase().includes(archiveSearch.toLowerCase())
        );
      }
    } else if (activeTab === 'countryManuals') {
      // If "__select__" is chosen, show empty list until user selects a country
      if (countryFilterTemplateId === '__select__') {
        return [];
      }
      // Show only country copies (non-master) that are active
      filtered = filtered.filter(m => {
        const isActive = (m as any).isActive;
        const isArchived = (m as any).isArchived;
        const isMaster = (m as any).isMaster;
        // Must be active (not deleted, not archived)
        const isReallyActive = isActive === true || isActive === 1 || isActive === undefined;
        const notArchived = !isArchived || isArchived === 0 || isArchived === false;
        // Must be non-master (country copy)
        const isCountryCopy = isMaster === false || isMaster === 0;
        return isReallyActive && notArchived && isCountryCopy;
      });
      // Further filter by selected country template (empty string = all countries)
      if (countryFilterTemplateId && countryFilterTemplateId !== '__select__') {
        filtered = filtered.filter(m => (m as any).priceTemplateId === countryFilterTemplateId);
      }
      // Apply search filter
      if (countrySearch) {
        filtered = filtered.filter(m => 
          m.name?.toLowerCase().includes(countrySearch.toLowerCase()) ||
          m.koreanName?.toLowerCase().includes(countrySearch.toLowerCase())
        );
      }
      // Apply category filter
      if (countryCategoryFilter) {
        filtered = filtered.filter(m => (m as any).category === countryCategoryFilter);
      }
    } else {
      // Show active (not deleted, not archived) manuals - for manuals tab, show only masters
      // isActive must be true (or 1) AND isArchived must be false (or 0)
      filtered = filtered.filter(m => {
        const isActive = (m as any).isActive;
        const isArchived = (m as any).isArchived;
        // Active: isActive is true/1/undefined(legacy) AND isArchived is false/0/undefined
        const isReallyActive = isActive === true || isActive === 1 || isActive === undefined;
        const notArchived = !isArchived || isArchived === 0 || isArchived === false;
        return isReallyActive && notArchived;
      });
      if (activeTab === 'manuals') {
        // Show only master manuals (isMaster = true or null for legacy)
        filtered = filtered.filter(m => (m as any).isMaster !== false && (m as any).isMaster !== 0);
        // Apply search filter
        if (masterSearch) {
          filtered = filtered.filter(m => 
            m.name?.toLowerCase().includes(masterSearch.toLowerCase()) ||
            m.koreanName?.toLowerCase().includes(masterSearch.toLowerCase())
          );
        }
        // Apply category filter
        if (masterCategoryFilter) {
          filtered = filtered.filter(m => (m as any).category === masterCategoryFilter);
        }
      }
    }
    
    // Apply linking filter
    if (linkingFilter === 'linked') {
      // Only fully linked manuals
      filtered = filtered.filter(m => m.linkingStats?.isFullyLinked === true);
    } else if (linkingFilter === 'unlinked') {
      // Only manuals with at least one unlinked ingredient
      filtered = filtered.filter(m => m.linkingStats?.hasUnlinked === true);
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
    const filtered = getFilteredManuals();
    const totalCount = filtered.length;
    const itemsPerPage = getCurrentNumericItemsPerPage(totalCount);
    // Apply pagination (전체보기인 경우 모든 아이템 반환)
    if (getCurrentItemsPerPage() === 'all') {
      return filtered;
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };
  
  // Get total count for pagination
  const getTotalFilteredCount = () => {
    return getFilteredManuals().length;
  };
  
  // Get total pages
  const getTotalPages = () => {
    const totalCount = getTotalFilteredCount();
    if (getCurrentItemsPerPage() === 'all') return 1;
    const itemsPerPage = getCurrentNumericItemsPerPage(totalCount);
    return Math.ceil(totalCount / itemsPerPage);
  };
  
  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, linkingFilter, countryFilterTemplateId, masterCategoryFilter, countryCategoryFilter, costTableCategoryFilter]);
  
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
            Master Manuals ({savedManuals.filter(m => {
              const isActive = (m as any).isActive;
              const isArchived = (m as any).isArchived;
              const isMaster = (m as any).isMaster;
              const isReallyActive = isActive === true || isActive === 1 || isActive === undefined;
              const notArchived = !isArchived || isArchived === 0 || isArchived === false;
              const isReallyMaster = isMaster !== false && isMaster !== 0;
              return isReallyActive && notArchived && isReallyMaster;
            }).length})
            {(() => {
              const unlinkedCount = savedManuals.filter(m => 
                !(m as any).isArchived && 
                (m as any).isMaster !== false && 
                (m as any).isMaster !== 0 &&
                m.linkingStats?.hasUnlinked
              ).length;
              return unlinkedCount > 0 ? (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full" title={`${unlinkedCount} unlinked`}>
                  ⚠️{unlinkedCount}
                </span>
              ) : null;
            })()}
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
            Country Manuals
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
            Trash ({savedManuals.filter(m => {
              const isActive = (m as any).isActive;
              const isArchived = (m as any).isArchived;
              return (isActive === false || isActive === 0) && (isArchived === false || isArchived === 0 || !isArchived);
            }).length})
          </button>
          {/* Archive tab - master admin only */}
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
              Archive ({savedManuals.filter(m => !!(m as any).isArchived).length})
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
              {cookingSteps.map((step, i) => {
                return (
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
              );
              })}
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
              {cookingSteps.some(s => (s.manual && !s.process)) && (
                <div className="mb-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded text-orange-700 text-sm flex items-center gap-2">
                  <span>⚠️</span>
                  <span>프로세스가 지정되지 않은 단계가 있습니다. 수정하기를 눌러 프로세스를 선택하세요.</span>
                </div>
              )}
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border px-3 py-2 text-left w-40">PROCESS</th>
                    <th className="border px-3 py-2 text-left">MANUAL</th>
                  </tr>
                </thead>
                <tbody>
                  {cookingSteps.filter(s => s.process || s.manual).map((step, idx) => (
                    <tr key={idx} className={`${idx % 2 === 1 ? 'bg-gray-50' : ''} ${(!step.process && step.manual) ? 'bg-orange-50' : ''}`}>
                      <td className="border px-3 py-2 font-medium align-top">
                        {step.process || (
                          <span className="text-orange-600 flex items-center gap-1">
                            <span>⚠️</span> 미지정
                          </span>
                        )}
                      </td>
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
            {/* Country Manuals 탭 전용 UI */}
            {activeTab === 'countryManuals' ? (
              <div className="flex items-center gap-3 flex-wrap">
                {/* Search */}
                <div className="min-w-[180px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="메뉴명 검색..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Country Filter */}
                <div className="min-w-[140px]">
                  <select
                    value={countryFilterTemplateId}
                    onChange={(e) => setCountryFilterTemplateId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="__select__">모든 국가</option>
                    <option value="">All Countries</option>
                    {priceTemplates.filter(t => t.name !== "Master Template").map(t => (
                      <option key={t.id} value={t.id}>{t.country}</option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div className="min-w-[120px]">
                  <select
                    value={countryCategoryFilter}
                    onChange={(e) => setCountryCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">모든 카테고리</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* 식재료 수정 (Linking Review) */}
                <button
                  onClick={() => {
                    // 선택된 매뉴얼이 있으면 그것만, 없으면 전체
                    if (selectedManualIds.size > 0) {
                      openLinkingReviewModalWithSelected(Array.from(selectedManualIds));
                    } else {
                      openLinkingReviewModal();
                    }
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center text-sm"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  식재료 수정 {selectedManualIds.size > 0 ? `(${selectedManualIds.size}개)` : ''}
                </button>

                {/* 판매가 수정 (Bulk Price Edit) */}
                <button
                  onClick={() => setShowBulkPriceModal(true)}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center text-sm"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  판매가 수정
                </button>

                {/* 카테고리 일괄 설정 */}
                <button
                  onClick={() => {
                    if (selectedManualsForCategory.size === 0) {
                      alert('먼저 매뉴얼을 선택해주세요 (체크박스)');
                      return;
                    }
                    setShowCategoryAssignModal(true);
                  }}
                  disabled={selectedManualsForCategory.size === 0}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  카테고리 설정 ({selectedManualsForCategory.size})
                </button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* 선택 작업 & 삭제 */}
                <div className="flex flex-col items-end gap-1">
                  {selectedManualIds.size > 0 && (
                    <span className="text-xs text-blue-600 font-medium">{selectedManualIds.size}개 선택됨</span>
                  )}
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedManualIds.size === 0}
                    className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> 삭제
                  </button>
                </div>
              </div>
            ) : (
            /* 기존 다른 탭들의 UI */
            <div className="flex items-end gap-4 flex-wrap">
              {/* Left: Info */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {activeTab === 'trash' ? '휴지통' : activeTab === 'archived' ? '보관함' : '매뉴얼 마스터'}
                </label>
                <p className="text-sm text-gray-500">
                  {activeTab === 'trash'
                    ? `총 ${savedManuals.filter(m => {
                        const matchesSearch = !trashSearch || 
                          (m.name?.toLowerCase().includes(trashSearch.toLowerCase()) ||
                           m.koreanName?.toLowerCase().includes(trashSearch.toLowerCase()));
                        return (m as any).isActive === false && matchesSearch;
                      }).length}개 삭제된 매뉴얼`
                    : activeTab === 'archived'
                    ? `총 ${savedManuals.filter(m => {
                        const matchesSearch = !archiveSearch || 
                          (m.name?.toLowerCase().includes(archiveSearch.toLowerCase()) ||
                           m.koreanName?.toLowerCase().includes(archiveSearch.toLowerCase()));
                        return (m as any).isArchived === true && matchesSearch;
                      }).length}개 보관된 매뉴얼`
                    : `총 ${savedManuals.filter(m => {
                        const isActive = (m as any).isActive;
                        const isArchived = (m as any).isArchived;
                        const isMasterFlag = (m as any).isMaster;
                        const isReallyActive = isActive === true || isActive === 1 || isActive === undefined;
                        const notArchived = !isArchived || isArchived === 0 || isArchived === false;
                        const isReallyMaster = isMasterFlag !== false && isMasterFlag !== 0;
                        const matchesSearch = !masterSearch || 
                          (m.name?.toLowerCase().includes(masterSearch.toLowerCase()) ||
                           m.koreanName?.toLowerCase().includes(masterSearch.toLowerCase()));
                        return isReallyActive && notArchived && isReallyMaster && matchesSearch;
                      }).length}개 마스터 매뉴얼`
                  }
                </p>
              </div>

              {/* Search Box for each tab */}
              <div className="min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="메뉴명 검색..."
                    value={activeTab === 'manuals' ? masterSearch : activeTab === 'trash' ? trashSearch : archiveSearch}
                    onChange={(e) => {
                      if (activeTab === 'manuals') setMasterSearch(e.target.value);
                      else if (activeTab === 'trash') setTrashSearch(e.target.value);
                      else setArchiveSearch(e.target.value);
                    }}
                    className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Category Filter (for manuals tab) */}
              {activeTab === 'manuals' && (
                <div className="min-w-[120px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                  <select
                    value={masterCategoryFilter}
                    onChange={(e) => setMasterCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">전체</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Excel Upload Button (for manuals tab) */}
              {activeTab === 'manuals' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowExcelUploadModal(true)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    엑셀 업로드
                  </button>
                  <button
                    onClick={toggleMultiSelectMode}
                    className={`px-4 py-2 rounded-lg flex items-center ${
                      isMultiSelectMode 
                        ? 'bg-orange-500 text-white hover:bg-orange-600' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <CheckCheck className="w-4 h-4 mr-2" />
                    {isMultiSelectMode ? '선택 모드 ON' : '일괄 다운로드'}
                  </button>
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
                    <>
                      <button
                        onClick={handleBulkRestore}
                        disabled={selectedManualIds.size === 0}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" /> 선택 복구
                      </button>
                      {isMaster && (
                        <button
                          onClick={handleBulkPermanentDelete}
                          disabled={selectedManualIds.size === 0}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> 선택 완전삭제
                        </button>
                      )}
                    </>
                  )}
                  {activeTab === 'archived' && isMaster && (
                    <>
                      <button
                        onClick={handleBulkRestore}
                        disabled={selectedManualIds.size === 0}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" /> 휴지통으로 복구
                      </button>
                      <button
                        onClick={handleBulkPermanentDelete}
                        disabled={selectedManualIds.size === 0}
                        className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> 선택 영구삭제
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Manuals List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {isMultiSelectMode && (
              <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-orange-700">
                  <CheckCheck className="w-4 h-4" />
                  <span className="font-medium">다운로드 선택 모드</span>
                  <span className="text-orange-500">- 다운로드할 매뉴얼을 체크하세요</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => selectAllManualsForDownload(getGroupManuals())}
                    className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                  >
                    모두 선택
                  </button>
                  <button
                    onClick={clearManualsForDownload}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    선택 해제
                  </button>
                </div>
              </div>
            )}
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-center w-10">
                    {isMultiSelectMode ? (
                      <input
                        type="checkbox"
                        checked={selectedManualsForDownload.size > 0 && selectedManualsForDownload.size === getGroupManuals().length}
                        onChange={() => {
                          if (selectedManualsForDownload.size === getGroupManuals().length) {
                            clearManualsForDownload();
                          } else {
                            selectAllManualsForDownload(getGroupManuals());
                          }
                        }}
                        className="w-4 h-4 rounded border-orange-300 text-orange-500 focus:ring-orange-500"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={selectedManualIds.size > 0 && selectedManualIds.size === getTotalFilteredCount()}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                    )}
                  </th>
                  <th onClick={() => handleSort('name')} className="px-3 py-2 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100">
                    메뉴명 <SortIcon field="name" />
                  </th>
                  <th className="px-3 py-2 text-center text-sm font-medium text-gray-700">
                    <div className="flex items-center justify-center gap-1">
                      식재료 링킹
                      <select
                        value={linkingFilter}
                        onChange={(e) => setLinkingFilter(e.target.value as 'all' | 'linked' | 'unlinked')}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-1 text-xs border rounded px-1 py-0.5 bg-white"
                      >
                        <option value="all">전체</option>
                        <option value="linked">완료</option>
                        <option value="unlinked">미완료</option>
                      </select>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-center text-sm font-medium text-gray-700">
                    프로세스
                  </th>
                  {activeTab === 'countryManuals' && (
                    <th onClick={() => handleSort('country')} className="px-3 py-2 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100">
                      국가 <SortIcon field="country" />
                    </th>
                  )}
                  {activeTab === 'countryManuals' && (
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-700">
                      카테고리
                    </th>
                  )}
                  <th onClick={() => handleSort('sellingPrice')} className="px-3 py-2 text-right text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100">
                    판매가 <SortIcon field="sellingPrice" />
                  </th>
                  <th className="px-3 py-2 text-center text-sm font-medium text-gray-700">
                    수정일
                  </th>
                  {activeTab === 'trash' && (
                    <>
                      <th className="px-3 py-2 text-left text-sm font-medium text-gray-700">삭제 정보</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getGroupManuals().map((manual) => {
                  const isSelectedForDownload = selectedManualsForDownload.has(manual.id);
                  return (
                    <tr key={manual.id} className={`hover:bg-gray-50 ${
                      isMultiSelectMode && isSelectedForDownload ? 'bg-orange-50' : 
                      selectedManualIds.has(manual.id) ? 'bg-blue-50' : ''
                    }`}>
                      <td className="px-3 py-2 text-center">
                        {isMultiSelectMode ? (
                          <input
                            type="checkbox"
                            checked={isSelectedForDownload}
                            onChange={() => toggleManualForDownload(manual.id)}
                            className="w-4 h-4 rounded border-orange-300 text-orange-500 focus:ring-orange-500"
                          />
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedManualIds.has(manual.id)}
                            onChange={() => toggleManualSelection(manual.id)}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium">{manual.name}</div>
                            {manual.koreanName && manual.koreanName !== manual.name && (
                              <div className="text-sm text-gray-500">{manual.koreanName}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {manual.linkingStats ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              manual.linkingStats.isFullyLinked
                                ? 'bg-green-100 text-green-700'
                                : manual.linkingStats.hasUnlinked
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-500'
                            }`}>
                              {manual.linkingStats.linked}/{manual.linkingStats.total}
                            </span>
                            {manual.linkingStats.hasUnlinked && (
                              <span className="text-yellow-500" title={`${manual.linkingStats.unlinked}개 미링킹`}>⚠️</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {manual.processStats ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              manual.processStats.isFullyAssigned
                                ? 'bg-green-100 text-green-700'
                                : manual.processStats.unassigned > 0
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-500'
                            }`}>
                              {manual.processStats.assigned}/{manual.processStats.total}
                            </span>
                            {manual.processStats.unassigned > 0 && (
                              <span className="text-yellow-500" title={`${manual.processStats.unassigned}개 미지정`}>⚠️</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      {activeTab === 'countryManuals' && (
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Globe className="w-3 h-3 mr-1" />
                            {(manual as any).priceTemplate?.country || '국가 미지정'}
                          </span>
                        </td>
                      )}
                      {activeTab === 'countryManuals' && (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedManualsForCategory.has(manual.id)}
                              onChange={() => {
                                const newSet = new Set(selectedManualsForCategory);
                                if (newSet.has(manual.id)) {
                                  newSet.delete(manual.id);
                                } else {
                                  newSet.add(manual.id);
                                }
                                setSelectedManualsForCategory(newSet);
                              }}
                              className="w-3 h-3 rounded border-purple-300 text-purple-500 focus:ring-purple-500"
                              title="카테고리 설정용 선택"
                            />
                            {(manual as any).category ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                {(manual as any).category}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">미설정</span>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-3 py-2 text-right">
                        {manual.sellingPrice ? (
                          <span className="font-medium">${manual.sellingPrice.toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="text-xs text-gray-600">
                          <div>{(manual as any).createdAt ? new Date((manual as any).createdAt).toLocaleDateString('ko-KR') : '-'}</div>
                          {(manual as any).updatedAt && (manual as any).updatedAt !== (manual as any).createdAt && (
                            <div className="text-gray-400">수정: {new Date((manual as any).updatedAt).toLocaleDateString('ko-KR')}</div>
                          )}
                        </div>
                      </td>
                      {activeTab === 'trash' && (
                        <td className="px-3 py-2 text-sm text-gray-500">
                          <div>{(manual as any).deletedBy || 'Unknown'}</div>
                          <div className="text-xs text-gray-400">
                            {(manual as any).deletedAt ? new Date((manual as any).deletedAt).toLocaleDateString() : '-'}
                          </div>
                        </td>
                      )}
                      <td className="px-3 py-2">
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
                                onClick={() => handleViewVersionHistory(manual)}
                                className="p-1 text-gray-400 hover:text-purple-500" 
                                title="Version History"
                              >
                                <History className="w-4 h-4" />
                              </button>
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
                                className="p-1 text-gray-400 hover:text-purple-700 bg-purple-50 rounded" 
                                title="Move to Archive"
                              >
                                <Archive className="w-4 h-4 text-purple-600" />
                              </button>
                            </>
                          )}
                          {activeTab === 'archived' && (
                            <>
                              <button 
                                onClick={() => handleMasterRestore(manual)}
                                className="p-1 text-gray-400 hover:text-purple-500" 
                                title="Restore to Trash"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              {isMasterAdmin && (
                                <button 
                                  onClick={() => handlePermanentDelete(manual)}
                                  className="p-1 text-red-400 hover:text-red-700 bg-red-50 rounded" 
                                  title="Permanent Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {getGroupManuals().length === 0 && (
                  <tr>
                    <td colSpan={activeTab === 'trash' ? 9 : (activeTab === 'countryManuals' ? 9 : 8)} className="px-4 py-8 text-center text-gray-500">
                      {activeTab === 'manuals' 
                        ? '저장된 매뉴얼이 없습니다. Manual Editor에서 새 매뉴얼을 작성하세요.'
                        : activeTab === 'countryManuals'
                        ? countryFilterTemplateId === '__select__' 
                          ? '국가를 선택해주세요.'
                          : '국가별 매뉴얼이 없습니다. 마스터 매뉴얼을 국가에 복제해주세요.'
                        : activeTab === 'trash'
                        ? '휴지통이 비어있습니다.'
                        : '완전 삭제된 매뉴얼이 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {/* Pagination & Items Per Page */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500">
                  {getCurrentItemsPerPage() === 'all' 
                    ? `총 ${getTotalFilteredCount()}개 표시`
                    : `총 ${getTotalFilteredCount()}개 중 ${Math.min(((currentPage - 1) * getCurrentNumericItemsPerPage(getTotalFilteredCount())) + 1, getTotalFilteredCount())}-${Math.min(currentPage * getCurrentNumericItemsPerPage(getTotalFilteredCount()), getTotalFilteredCount())}개 표시`
                  }
                </div>
                {/* Items per page selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">페이지당:</span>
                  <select
                    value={getCurrentItemsPerPage()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCurrentItemsPerPage(val === 'all' ? 'all' : parseInt(val) as 10 | 20 | 50 | 100);
                    }}
                    className="px-2 py-1 text-sm border rounded hover:border-gray-400"
                  >
                    {ITEMS_PER_PAGE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>
                        {getItemsPerPageLabel(opt)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {getTotalPages() > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, getTotalPages()) }, (_, i) => {
                      let pageNum;
                      if (getTotalPages() <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= getTotalPages() - 2) {
                        pageNum = getTotalPages() - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 text-sm border rounded ${
                            currentPage === pageNum
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(getTotalPages(), p + 1))}
                    disabled={currentPage === getTotalPages()}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                  <button
                    onClick={() => setCurrentPage(getTotalPages())}
                    disabled={currentPage === getTotalPages()}
                    className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    »
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cost Table Tab */}
      {activeTab === 'costTable' && (
        <div className="space-y-4">
          {/* Cost Table Header with Filter & Search */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold">원가표 (Cost Table)</h2>
                <p className="text-sm text-gray-500">
                  국가별 매뉴얼의 원가를 계산합니다 ({savedManuals.filter(m => {
                    const isActive = (m as any).isActive;
                    const matchesCountry = countryFilterTemplateId === '__select__' ? false : (!countryFilterTemplateId || (m as any).priceTemplateId === countryFilterTemplateId);
                    const matchesSearch = !costTableSearch || 
                      (m.name?.toLowerCase().includes(costTableSearch.toLowerCase()) ||
                       m.koreanName?.toLowerCase().includes(costTableSearch.toLowerCase()));
                    return (isActive === true || isActive === 1 || isActive === undefined) && 
                           ((m as any).isMaster === false || (m as any).isMaster === 0) &&
                           matchesCountry && matchesSearch;
                  }).length}개)
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="메뉴 검색..."
                    value={costTableSearch}
                    onChange={(e) => setCostTableSearch(e.target.value)}
                    className="pl-9 pr-3 py-2 border rounded-lg text-sm w-48"
                  />
                </div>
                {/* Country Filter */}
                <div>
                  <select
                    value={countryFilterTemplateId}
                    onChange={(e) => setCountryFilterTemplateId(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="__select__">-- Select --</option>
                    <option value="">All Countries</option>
                    {priceTemplates.filter(t => t.name !== "Master Template").map(t => (
                      <option key={t.id} value={t.id}>{t.country} ({t.currency || 'CAD'})</option>
                    ))}
                  </select>
                </div>
                {/* Category Filter */}
                <div>
                  <select
                    value={costTableCategoryFilter}
                    onChange={(e) => setCostTableCategoryFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">모든 카테고리</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                {/* Bulk Download Button */}
                <button
                  onClick={toggleMultiSelectMode}
                  className={`px-4 py-2 rounded-lg flex items-center ${
                    isMultiSelectMode 
                      ? 'bg-orange-500 text-white hover:bg-orange-600' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <CheckCheck className="w-4 h-4 mr-2" />
                  {isMultiSelectMode ? '선택 모드 ON' : '일괄 다운로드'}
                </button>
                {/* 판매가 일괄 수정 버튼 */}
                <button
                  onClick={() => setShowBulkPriceModal(true)}
                  disabled={countryFilterTemplateId === '__select__'}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  판매가 일괄 수정
                </button>
              </div>
            </div>
          </div>

          {/* Cost Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {isMultiSelectMode && (
              <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-orange-700">
                  <CheckCheck className="w-4 h-4" />
                  <span className="font-medium">다운로드 선택 모드</span>
                  <span className="text-orange-500">- 다운로드할 원가표를 체크하세요</span>
                </div>
              </div>
            )}
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {isMultiSelectMode && (
                    <th className="px-3 py-2 text-center w-10">
                      <input
                        type="checkbox"
                        checked={(() => {
                          const filteredManuals = savedManuals.filter(m => {
                            const isActive = (m as any).isActive;
                            const matchesCountry = countryFilterTemplateId === '__select__' ? false : (!countryFilterTemplateId || (m as any).priceTemplateId === countryFilterTemplateId);
                            const matchesSearch = !costTableSearch || 
                              (m.name?.toLowerCase().includes(costTableSearch.toLowerCase()) ||
                               m.koreanName?.toLowerCase().includes(costTableSearch.toLowerCase()));
                            return (isActive === true || isActive === 1 || isActive === undefined) && 
                                   ((m as any).isMaster === false || (m as any).isMaster === 0) &&
                                   matchesCountry && matchesSearch;
                          });
                          return selectedManualsForDownload.size > 0 && selectedManualsForDownload.size === filteredManuals.length;
                        })()}
                        onChange={() => {
                          const filteredManuals = savedManuals.filter(m => {
                            const isActive = (m as any).isActive;
                            const matchesCountry = countryFilterTemplateId === '__select__' ? false : (!countryFilterTemplateId || (m as any).priceTemplateId === countryFilterTemplateId);
                            const matchesSearch = !costTableSearch || 
                              (m.name?.toLowerCase().includes(costTableSearch.toLowerCase()) ||
                               m.koreanName?.toLowerCase().includes(costTableSearch.toLowerCase()));
                            return (isActive === true || isActive === 1 || isActive === undefined) && 
                                   ((m as any).isMaster === false || (m as any).isMaster === 0) &&
                                   matchesCountry && matchesSearch;
                          });
                          if (selectedManualsForDownload.size === filteredManuals.length) {
                            clearManualsForDownload();
                          } else {
                            selectAllManualsForDownload(filteredManuals);
                          }
                        }}
                        className="w-4 h-4 rounded border-orange-300 text-orange-500 focus:ring-orange-500"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-8"></th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">메뉴명</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Menu Name</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">링킹 현황</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Food Cost</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Package</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Total Cost</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">판매가</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">원가율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(() => {
                  // Filter to show only country manuals (non-master, matching country filter, matching search, matching category)
                  const filteredManuals = savedManuals.filter(m => {
                    const isActive = (m as any).isActive;
                    const matchesCountry = countryFilterTemplateId === '__select__' ? false : (!countryFilterTemplateId || (m as any).priceTemplateId === countryFilterTemplateId);
                    const matchesSearch = !costTableSearch || 
                      (m.name?.toLowerCase().includes(costTableSearch.toLowerCase()) ||
                       m.koreanName?.toLowerCase().includes(costTableSearch.toLowerCase()));
                    const matchesCategory = !costTableCategoryFilter || (m as any).category === costTableCategoryFilter;
                    return (isActive === true || isActive === 1 || isActive === undefined) && 
                           ((m as any).isMaster === false || (m as any).isMaster === 0) &&
                           matchesCountry && matchesSearch && matchesCategory;
                  });
                  
                  if (filteredManuals.length === 0) {
                    return (
                      <tr>
                        <td colSpan={isMultiSelectMode ? 10 : 9} className="px-4 py-8 text-center text-gray-500">
                          {countryFilterTemplateId === '__select__' ? '국가를 선택해주세요.' : countryFilterTemplateId ? '선택한 국가에 매뉴얼이 없습니다.' : '국가별 매뉴얼이 없습니다. 마스터 매뉴얼을 국가에 복제해주세요.'}
                        </td>
                      </tr>
                    );
                  }
                  
                  return filteredManuals.map(manual => {
                    // Calculate food cost from ingredients: (사용량 / 기준수량) × 단가
                    const ingredientCount = manual.ingredients?.length || 0;
                    // 링킹된 식재료 수 계산 (ingredientId가 있으면 링킹됨)
                    const linkedIngredientCount = manual.ingredients?.filter((ing: any) => 
                      ing.ingredientId
                    ).length || 0;
                    
                    // Food cost: 투고용기가 아닌 식재료만 계산 (수율 반영)
                    const foodCost = manual.ingredients?.reduce((sum: number, ing: any) => {
                      if (ing.isPackage) return sum; // 투고용기는 제외
                      const usageQty = ing.quantity || 0;
                      const baseQty = ing.baseQuantity || 1;
                      const price = ing.unitPrice || 0;
                      // 수율(yield) 반영: yieldRate가 95면 실제 원가는 더 높아짐 (100/95 = 1.05배)
                      const yieldRate = ing.yieldRate || ing.linkedIngredient?.yieldRate || 100;
                      const yieldFactor = yieldRate > 0 ? (100 / yieldRate) : 1;
                      const cost = baseQty > 0 ? ((usageQty / baseQty) * price) * yieldFactor : 0;
                      return sum + cost;
                    }, 0) || 0;
                    
                    // Package cost: 투고용기로 설정된 식재료만 계산 (수율 반영)
                    const packageCost = manual.ingredients?.reduce((sum: number, ing: any) => {
                      if (!ing.isPackage) return sum; // 식재료는 제외
                      const usageQty = ing.quantity || 0;
                      const baseQty = ing.baseQuantity || 1;
                      const price = ing.unitPrice || 0;
                      // 수율(yield) 반영
                      const yieldRate = ing.yieldRate || ing.linkedIngredient?.yieldRate || 100;
                      const yieldFactor = yieldRate > 0 ? (100 / yieldRate) : 1;
                      const cost = baseQty > 0 ? ((usageQty / baseQty) * price) * yieldFactor : 0;
                      return sum + cost;
                    }, 0) || 0;
                    
                    const totalCost = foodCost + packageCost;
                    const sellingPrice = manual.sellingPrice || 0;
                    const foodCostRate = sellingPrice > 0 ? ((foodCost / sellingPrice) * 100) : 0;
                    const totalCostRate = sellingPrice > 0 ? ((totalCost / sellingPrice) * 100) : 0;
                    const isExpanded = expandedCostManualId === manual.id;
                    const isSelectedForDownload = selectedManualsForDownload.has(manual.id);
                    
                    return (
                      <Fragment key={manual.id}>
                        <tr 
                          className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''} ${isMultiSelectMode && isSelectedForDownload ? 'bg-orange-50' : ''}`}
                          onClick={() => {
                            if (!isMultiSelectMode) {
                              setExpandedCostManualId(isExpanded ? null : manual.id);
                            }
                          }}
                        >
                          {isMultiSelectMode && (
                            <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelectedForDownload}
                                onChange={() => toggleManualForDownload(manual.id)}
                                className="w-4 h-4 rounded border-orange-300 text-orange-500 focus:ring-orange-500"
                              />
                            </td>
                          )}
                          <td className="px-4 py-3 text-center" onClick={() => setExpandedCostManualId(isExpanded ? null : manual.id)}>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </td>
                          <td className="px-4 py-3 font-medium">{manual.koreanName || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{manual.name}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`font-medium ${linkedIngredientCount === ingredientCount && ingredientCount > 0 ? 'text-green-600' : linkedIngredientCount === 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                              {linkedIngredientCount}/{ingredientCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">${foodCost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-500">${packageCost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">${totalCost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">
                            {inlineEditingPriceId === manual.id ? (
                              <div className="flex items-center gap-1 justify-end">
                                <span className="text-gray-500">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={inlineEditPriceValue}
                                  onChange={(e) => setInlineEditPriceValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const newPrice = parseFloat(inlineEditPriceValue) || 0;
                                      saveInlinePrice(manual.id, newPrice);
                                    } else if (e.key === 'Escape') {
                                      setInlineEditingPriceId(null);
                                      setInlineEditPriceValue('');
                                    }
                                  }}
                                  onBlur={() => {
                                    const newPrice = parseFloat(inlineEditPriceValue) || 0;
                                    saveInlinePrice(manual.id, newPrice);
                                  }}
                                  className="w-20 px-2 py-1 border border-green-400 rounded text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <span
                                onClick={() => {
                                  setInlineEditingPriceId(manual.id);
                                  setInlineEditPriceValue(sellingPrice.toFixed(2));
                                }}
                                className={`font-mono cursor-pointer hover:bg-green-100 px-2 py-1 rounded ${sellingPrice === 0 ? 'text-red-500' : ''}`}
                                title="클릭하여 판매가 수정"
                              >
                                ${sellingPrice.toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={`font-medium ${totalCostRate > 35 ? 'text-red-600' : 'text-green-600'}`}>
                              {totalCostRate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                        
                        {/* Expanded Cost Detail Card */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="px-4 py-4 bg-gray-50">
                              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                <div className="grid grid-cols-2 gap-6">
                                  {/* Left: Food Cost Breakdown */}
                                  <div>
                                    <h4 className="font-bold text-sm mb-3 text-gray-800 border-b pb-2">
                                      Food Cost Breakdown
                                    </h4>
                                    <table className="w-full text-xs">
                                      <thead className="bg-orange-100">
                                        <tr>
                                          <th className="px-2 py-1 text-left">Ingredient</th>
                                          <th className="px-2 py-1 text-right">Weight</th>
                                          <th className="px-2 py-1 text-right">Unit Price</th>
                                          <th className="px-2 py-1 text-right">Cost</th>
                                          <th className="px-2 py-1 text-right">%</th>
                                          <th className="px-2 py-1 text-center">📦</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {/* Food ingredients (not package) */}
                                        {manual.ingredients?.filter((ing: any) => !ing.isPackage).map((ing: any, i: number) => {
                                          const usageQty = ing.quantity || 0;
                                          const baseQty = ing.baseQuantity || 1;
                                          const price = ing.unitPrice || 0;
                                          // 수율(yield) 반영
                                          const yieldRate = ing.yieldRate || ing.linkedIngredient?.yieldRate || 100;
                                          const yieldFactor = yieldRate > 0 ? (100 / yieldRate) : 1;
                                          const ingCost = baseQty > 0 ? ((usageQty / baseQty) * price) * yieldFactor : 0;
                                          const portion = foodCost > 0 ? (ingCost / foodCost * 100) : 0;
                                          return (
                                            <tr key={i} className="border-b border-gray-100">
                                              <td className="px-2 py-1">{ing.name || ing.koreanName}</td>
                                              <td className="px-2 py-1 text-right">{usageQty} {ing.unit}</td>
                                              <td className="px-2 py-1 text-right">${price.toFixed(3)}</td>
                                              <td className="px-2 py-1 text-right font-mono">${ingCost.toFixed(2)}</td>
                                              <td className="px-2 py-1 text-right">{portion.toFixed(1)}%</td>
                                              <td className="px-2 py-1 text-center">
                                                <button
                                                  onClick={async (e) => {
                                                    e.stopPropagation();
                                                    try {
                                                      await fetch('/api/ingredients/package', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ ingredientIds: [ing.id], isPackage: true })
                                                      });
                                                      fetchData();
                                                    } catch (err) { console.error(err); }
                                                  }}
                                                  className="text-gray-400 hover:text-orange-500"
                                                  title="투고용기로 설정"
                                                >
                                                  <Package className="w-3 h-3" />
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                        <tr className="bg-orange-50 font-bold">
                                          <td className="px-2 py-1" colSpan={3}>Food Total</td>
                                          <td className="px-2 py-1 text-right font-mono">${foodCost.toFixed(2)}</td>
                                          <td className="px-2 py-1 text-right">100%</td>
                                          <td></td>
                                        </tr>
                                      </tbody>
                                    </table>
                                    
                                    {/* Package Items Section */}
                                    {manual.ingredients?.some((ing: any) => ing.isPackage) && (
                                      <div className="mt-4">
                                        <h4 className="font-bold text-sm mb-2 text-gray-800 flex items-center gap-1">
                                          <Package className="w-4 h-4 text-blue-500" /> 투고용기 (Package Items)
                                        </h4>
                                        <table className="w-full text-xs">
                                          <thead className="bg-blue-100">
                                            <tr>
                                              <th className="px-2 py-1 text-left">Item</th>
                                              <th className="px-2 py-1 text-right">Qty</th>
                                              <th className="px-2 py-1 text-right">Unit Price</th>
                                              <th className="px-2 py-1 text-right">Cost</th>
                                              <th className="px-2 py-1 text-center">❌</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {manual.ingredients?.filter((ing: any) => ing.isPackage).map((ing: any, i: number) => {
                                              const usageQty = ing.quantity || 0;
                                              const baseQty = ing.baseQuantity || 1;
                                              const price = ing.unitPrice || 0;
                                              // 수율(yield) 반영
                                              const yieldRate = ing.yieldRate || ing.linkedIngredient?.yieldRate || 100;
                                              const yieldFactor = yieldRate > 0 ? (100 / yieldRate) : 1;
                                              const ingCost = baseQty > 0 ? ((usageQty / baseQty) * price) * yieldFactor : 0;
                                              return (
                                                <tr key={i} className="border-b border-blue-100">
                                                  <td className="px-2 py-1">{ing.name || ing.koreanName}</td>
                                                  <td className="px-2 py-1 text-right">{usageQty} {ing.unit}</td>
                                                  <td className="px-2 py-1 text-right">${price.toFixed(3)}</td>
                                                  <td className="px-2 py-1 text-right font-mono">${ingCost.toFixed(2)}</td>
                                                  <td className="px-2 py-1 text-center">
                                                    <button
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                          await fetch('/api/ingredients/package', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ ingredientIds: [ing.id], isPackage: false })
                                                          });
                                                          fetchData();
                                                        } catch (err) { console.error(err); }
                                                      }}
                                                      className="text-gray-400 hover:text-red-500"
                                                      title="식재료로 되돌리기"
                                                    >
                                                      <X className="w-3 h-3" />
                                                    </button>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                            <tr className="bg-blue-50 font-bold">
                                              <td className="px-2 py-1" colSpan={3}>Package Total</td>
                                              <td className="px-2 py-1 text-right font-mono">${packageCost.toFixed(2)}</td>
                                              <td></td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Right: Summary */}
                                  <div>
                                    <h4 className="font-bold text-sm mb-3 text-gray-800 border-b pb-2">
                                      Cost Summary
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600">Food Cost</span>
                                        <span className="font-mono font-medium">${foodCost.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600 flex items-center gap-1">
                                          <Package className="w-3 h-3 text-blue-500" /> Package Cost
                                        </span>
                                        <span className="font-mono">${packageCost.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b bg-yellow-50 -mx-2 px-2">
                                        <span className="font-bold">Total Cost (Inc. package)</span>
                                        <span className="font-mono font-bold">${totalCost.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600">Selling Price</span>
                                        <span className="font-mono">${sellingPrice.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600">Margin</span>
                                        <span className="font-mono text-green-600">${(sellingPrice - totalCost).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between py-2">
                                        <span className="text-gray-600">Food Cost %</span>
                                        <span className={`font-bold ${foodCostRate > 30 ? 'text-red-600' : 'text-green-600'}`}>
                                          {foodCostRate.toFixed(1)}%
                                        </span>
                                      </div>
                                      <div className="flex justify-between py-2 bg-blue-50 -mx-2 px-2 rounded">
                                        <span className="font-bold">Total Cost %</span>
                                        <span className={`font-bold ${totalCostRate > 35 ? 'text-red-600' : 'text-green-600'}`}>
                                          {totalCostRate.toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              <strong>원가 계산 방법:</strong> (사용량 / 기준수량) × 단가<br/>
              예) Pricing에서 1,000g에 $10 → 매뉴얼에서 100g 사용 → 원가 = (100 / 1000) × $10 = $1<br/>
              <strong>Package Cost:</strong> 현재 Food Cost의 10%로 자동 계산됩니다.
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
                {((previewManual as any).imageUrl || (previewManual as any).imageData) && (
                  <div className="grid grid-cols-6 border-b border-black">
                    <div className="col-span-1 bg-gray-200 p-2 border-r border-black font-bold">사진</div>
                    <div className="col-span-5 p-2 flex justify-center">
                      <img 
                        src={(previewManual as any).imageData || (previewManual as any).imageUrl} 
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
              <button onClick={() => { setShowExcelUploadModal(false); setExcelFile(null); setExcelPreviewData(null); setExcelConfirmedManuals(new Set()); setExcelPreviewIndex(0); setUploadTargetTemplateId('master'); }}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Upload Target Selection - Country Template Dropdown */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-800">업로드 대상 선택</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={uploadTargetTemplateId}
                      onChange={(e) => {
                        if (e.target.value === '__create__') {
                          setShowCreateTemplateModal(true);
                        } else {
                          setUploadTargetTemplateId(e.target.value);
                        }
                      }}
                      className="px-4 py-2 border border-blue-300 rounded-lg bg-white text-blue-800 font-medium focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                    >
                      <option value="master">📋 마스터 매뉴얼</option>
                      <optgroup label="국가별 템플릿">
                        {priceTemplates.filter(t => t.name !== "Master Template").map(t => (
                          <option key={t.id} value={t.id}>🌍 {t.name} ({t.country})</option>
                        ))}
                      </optgroup>
                      <option value="__create__">➕ 새 국가 템플릿 생성...</option>
                    </select>
                  </div>
                </div>
                {uploadTargetTemplateId !== 'master' && uploadTargetTemplateId !== '__create__' && (
                  <p className="mt-2 text-sm text-blue-600">
                    ✨ 선택된 국가 템플릿의 가격이 자동으로 적용됩니다
                  </p>
                )}
              </div>

              {/* File Input with Drag & Drop */}
              {!excelPreviewData && (
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging 
                      ? 'border-orange-500 bg-orange-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-orange-500' : 'text-gray-400'}`} />
                  <p className="text-gray-600 mb-4">
                    {isDragging 
                      ? '여기에 파일을 놓으세요!' 
                      : '엑셀 파일(.xlsx)을 드래그하거나 선택해주세요'}
                  </p>
                  <label className="cursor-pointer bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 inline-block">
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

                            {/* Manual Content - 엑셀과 동일한 레이아웃 */}
                            <div className="p-2 text-xs">
                              {/* === PAGE 1: 기본정보 + 식재료 === */}
                              <div className="border border-gray-400 bg-white">
                                {/* Row 1: Manual(Kitchen) Title */}
                                <div className="bg-orange-500 text-white text-center py-2 font-bold text-sm border-b border-gray-400">
                                  Manual(Kitchen)
                                </div>
                                
                                {/* Row 2: Name */}
                                <div className="flex border-b border-gray-300">
                                  <div className="w-20 bg-gray-100 px-2 py-1 font-semibold border-r border-gray-300">Name</div>
                                  <div className="flex-1 px-2 py-1">{currentManual.name || '-'}</div>
                                </div>
                                
                                {/* Row 3-11: Picture & Item List */}
                                <div className="flex border-b border-gray-300">
                                  {/* Picture Section (A3:G11 area) */}
                                  <div className="w-3/4 border-r border-gray-300">
                                    <div className="flex">
                                      <div className="w-20 bg-gray-100 px-2 py-1 font-semibold border-r border-gray-300 flex items-center justify-center" 
                                           style={{ minHeight: '120px', writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                                        Picture
                                      </div>
                                      <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-400 text-center p-4" style={{ minHeight: '120px' }}>
                                        {currentManual.imageData ? (
                                          <img 
                                            src={currentManual.imageData} 
                                            alt={currentManual.name || 'Product'} 
                                            className="max-h-32 max-w-full object-contain"
                                          />
                                        ) : (
                                          <div>
                                            <Image className="w-8 h-8 mx-auto mb-1 opacity-30" />
                                            <span>이미지 없음</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Item List Section (H3:I11 area) */}
                                  <div className="w-1/4">
                                    <div className="bg-gray-100 px-2 py-1 font-semibold text-center border-b border-gray-300">Item List</div>
                                    <div className="px-2 py-1 text-gray-400 text-center" style={{ minHeight: '100px' }}>
                                      (비어 있음)
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Row 12-29: Ingredients Composition */}
                                <div className="flex">
                                  {/* Left Label: Ingredients Composition (세로 병합) */}
                                  <div className="w-20 bg-orange-100 font-semibold flex items-center justify-center border-r border-gray-300"
                                       style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', minHeight: '200px' }}>
                                    Ingredients Composition
                                  </div>
                                  {/* Ingredients Table */}
                                  <div className="flex-1">
                                    <table className="w-full">
                                      <thead className="bg-gray-100">
                                        <tr className="border-b border-gray-300">
                                          <th className="px-2 py-1 text-center border-r border-gray-200 w-10">NO</th>
                                          <th className="px-2 py-1 text-left border-r border-gray-200" colSpan={2}>Ingredients</th>
                                          <th className="px-2 py-1 text-right border-r border-gray-200 w-16">Weight</th>
                                          <th className="px-2 py-1 text-center border-r border-gray-200 w-12">Unit</th>
                                          <th className="px-2 py-1 text-center border-r border-gray-200 w-16">Purchase</th>
                                          <th className="px-2 py-1 text-left w-20">Others</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200">
                                        {currentManual.ingredients?.map((ing: any, idx: number) => (
                                          <tr key={idx}>
                                            <td className="px-2 py-1 text-center border-r border-gray-200">{ing.no || idx + 1}</td>
                                            <td className="px-2 py-1 border-r border-gray-200" colSpan={2}>{ing.name}</td>
                                            <td className="px-2 py-1 text-right border-r border-gray-200">{ing.quantity || ing.weight || '-'}</td>
                                            <td className="px-2 py-1 text-center border-r border-gray-200">{ing.unit || 'g'}</td>
                                            <td className="px-2 py-1 text-center border-r border-gray-200">{ing.purchase || 'Local'}</td>
                                            <td className="px-2 py-1 text-left">{ing.others || ''}</td>
                                          </tr>
                                        ))}
                                        {(!currentManual.ingredients || currentManual.ingredients.length === 0) && (
                                          <tr>
                                            <td colSpan={7} className="px-2 py-4 text-center text-gray-400">
                                              식재료 정보 없음
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                                
                                {/* Row 30: BBQ CANADA Footer */}
                                <div className="text-right px-4 py-1 text-gray-600 font-semibold border-t border-gray-300">
                                  BBQ CANADA
                                </div>
                              </div>
                              
                              {/* === PAGE 2: COOKING METHOD === */}
                              <div className="border border-gray-400 bg-white mt-3">
                                {/* COOKING METHOD Header */}
                                <div className="bg-orange-500 text-white text-center py-2 font-bold text-sm">
                                  COOKING METHOD
                                </div>
                                
                                {/* PROCESS / MANUAL Header */}
                                <div className="flex border-b border-gray-300">
                                  <div className="w-32 bg-gray-100 px-2 py-1 font-semibold text-center border-r border-gray-300">PROCESS</div>
                                  <div className="flex-1 bg-gray-100 px-2 py-1 font-semibold text-center">MANUAL</div>
                                </div>
                                
                                {/* Cooking Steps */}
                                <div className="max-h-64 overflow-y-auto">
                                  {currentManual.cookingMethod?.map((step: any, idx: number) => {
                                    // PNG filename fallback: use step.pngFilename or try to match from process name
                                    const pngFilename = step.pngFilename || (() => {
                                      const match = matchProcessPng(step.process || '', DEFAULT_PROCESS_ASSET_INDEX);
                                      return match.filename || null;
                                    })();
                                    
                                    return (
                                    <div key={idx} className="flex border-b border-gray-200 last:border-b-0">
                                      {/* Process with PNG Icon */}
                                      <div className="w-32 px-2 py-2 border-r border-gray-200 bg-gray-50 flex flex-col items-center justify-center">
                                        {pngFilename ? (
                                          <img 
                                            src={`/process-png/${encodeURIComponent(pngFilename)}`}
                                            alt={step.process}
                                            className="w-16 h-16 object-contain mb-1"
                                            onError={(e) => {
                                              // 이미지 로드 실패 시 프로세스명 텍스트로 대체
                                              (e.target as HTMLImageElement).style.display = 'none';
                                              const parent = (e.target as HTMLImageElement).parentElement;
                                              if (parent) {
                                                const fallback = document.createElement('div');
                                                fallback.className = 'w-16 h-16 border-2 border-gray-300 rounded flex items-center justify-center text-gray-500 text-xs mb-1';
                                                fallback.textContent = step.process?.slice(0, 8) || '?';
                                                parent.insertBefore(fallback, e.target as HTMLImageElement);
                                              }
                                            }}
                                          />
                                        ) : (
                                          <div className="w-16 h-16 border-2 border-gray-300 rounded flex items-center justify-center text-gray-500 text-xs mb-1">
                                            {step.process?.slice(0, 8) || '?'}
                                          </div>
                                        )}
                                        <div className="font-medium text-orange-700 text-xs text-center">
                                          {step.process}
                                        </div>
                                        {step.processMatchInfo?.needsVerification && (
                                          <div className="text-xs text-yellow-600" title={`원본: ${step.processMatchInfo.originalText}`}>
                                            ⚠️ 확인
                                          </div>
                                        )}
                                      </div>
                                      {/* Manual Text */}
                                      <div className="flex-1 px-2 py-2 whitespace-pre-wrap">
                                        {step.manual?.split('\n').map((line: string, lineIdx: number) => (
                                          <div key={lineIdx} className="mb-1 last:mb-0">
                                            {line}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                  })}
                                  {(!currentManual.cookingMethod || currentManual.cookingMethod.length === 0) && (
                                    <div className="px-3 py-4 text-center text-gray-400">
                                      조리 방법 정보 없음
                                    </div>
                                  )}
                                </div>
                                
                                {/* BBQ CANADA Footer */}
                                <div className="text-right px-4 py-1 text-gray-600 font-semibold border-t border-gray-300">
                                  BBQ CANADA
                                </div>
                              </div>
                              
                              {/* Issues */}
                              {currentManual.issueDetails?.length > 0 && (
                                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded">
                                  <div className="font-medium text-orange-700 mb-1">확인 필요 사항:</div>
                                  <ul className="list-disc list-inside text-orange-600">
                                    {currentManual.issueDetails.map((issue: string, idx: number) => (
                                      <li key={idx}>{issue}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
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
                                }}
                                className={`px-4 py-2 rounded-lg flex items-center ${
                                  isConfirmed 
                                    ? 'bg-green-500 text-white hover:bg-green-600' 
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {isConfirmed ? '선택됨' : '업로드 선택'}
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

                  {/* Manual Selection Tabs */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-2">클릭하여 업로드할 매뉴얼 선택 (녹색 = 선택됨)</div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {excelPreviewData.allManuals.map((m: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) {
                              // Ctrl/Cmd+Click: Toggle selection
                              const newConfirmed = new Set(excelConfirmedManuals);
                              if (newConfirmed.has(idx)) {
                                newConfirmed.delete(idx);
                              } else {
                                newConfirmed.add(idx);
                              }
                              setExcelConfirmedManuals(newConfirmed);
                            } else {
                              // Normal click: View and toggle selection
                              setExcelPreviewIndex(idx);
                              const newConfirmed = new Set(excelConfirmedManuals);
                              if (newConfirmed.has(idx)) {
                                newConfirmed.delete(idx);
                              } else {
                                newConfirmed.add(idx);
                              }
                              setExcelConfirmedManuals(newConfirmed);
                            }
                          }}
                          onDoubleClick={() => setExcelPreviewIndex(idx)}
                          className={`flex-shrink-0 px-3 py-2 rounded text-xs border transition-all ${
                            excelConfirmedManuals.has(idx)
                              ? 'bg-green-500 text-white border-green-500'
                              : idx === excelPreviewIndex
                                ? 'bg-orange-100 text-orange-700 border-orange-300'
                                : m.hasLinkingIssue
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                          }`}
                          title={excelConfirmedManuals.has(idx) ? '선택됨 - 클릭하여 해제' : '클릭하여 선택'}
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
                      ? `📦 업로드 중: ${chunkProgress.saved}/${chunkProgress.total} 저장됨`
                      : `선택된 매뉴얼: ${excelConfirmedManuals.size}개 / 전체 ${excelPreviewData.allManuals.length}개`
                    }
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowExcelUploadModal(false); setExcelFile(null); setExcelPreviewData(null); setExcelConfirmedManuals(new Set()); setExcelPreviewIndex(0); setPendingManuals([]); setChunkProgress(null); setUploadTargetTemplateId('master'); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                {excelPreviewData?.allManuals?.length > 0 && (
                  <>
                    {/* Select All / Deselect All Button */}
                    <button
                      onClick={() => {
                        if (excelConfirmedManuals.size === excelPreviewData.allManuals.length) {
                          setExcelConfirmedManuals(new Set());
                        } else {
                          const allIndices = new Set<number>(excelPreviewData.allManuals.map((_: any, idx: number) => idx));
                          setExcelConfirmedManuals(allIndices);
                        }
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
                    >
                      <CheckCheck className="w-4 h-4 mr-2" />
                      {excelConfirmedManuals.size === excelPreviewData.allManuals.length ? '전체 해제' : '전체 선택'}
                    </button>
                    
                    {/* Upload Selected Button */}
                    <button
                      onClick={async () => {
                        if (excelConfirmedManuals.size === 0) {
                          alert('업로드할 매뉴얼을 선택해주세요.\n\n하단의 매뉴얼 탭을 클릭하여 선택하거나 "전체 선택" 버튼을 사용하세요.');
                          return;
                        }
                        
                        // Get selected manuals
                        const selectedManuals = excelPreviewData.allManuals.filter((_: any, idx: number) => 
                          excelConfirmedManuals.has(idx)
                        );
                        
                        // Always use handleExcelImport (has batch processing built-in)
                        handleExcelImport();
                      }}
                      disabled={isUploading || excelConfirmedManuals.size === 0}
                      className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {isUploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                      선택된 {excelConfirmedManuals.size}개 업로드
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showVersionModal && selectedVersionManual && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">버전 히스토리</h3>
                <p className="text-sm text-gray-500">
                  {selectedVersionManual.name} - 현재 v{versionHistory?.currentVersion || 1}
                </p>
              </div>
              <button onClick={() => { setShowVersionModal(false); setPreviewVersion(null); }} className="p-2 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              {isLoadingVersions ? (
                <div className="text-center py-8 text-gray-500">로딩 중...</div>
              ) : versionHistory?.versions?.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">아직 버전 히스토리가 없습니다.</p>
                  <p className="text-sm text-gray-400 mt-1">매뉴얼을 수정하면 이전 버전이 자동으로 저장됩니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Current Version */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="px-2 py-1 bg-green-500 text-white text-xs rounded font-medium">현재</span>
                        <span className="ml-2 font-medium">v{versionHistory?.currentVersion || 1}</span>
                        <span className="ml-2 text-sm text-gray-500">
                          {versionHistory?.lastUpdated ? new Date(versionHistory.lastUpdated).toLocaleString('ko-KR') : '-'}
                        </span>
                      </div>
                      <button
                        onClick={() => setPreviewVersion(previewVersion === 'current' ? null : 'current')}
                        className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${previewVersion === 'current' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        <Eye className="w-4 h-4" />
                        미리보기
                      </button>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">{selectedVersionManual.name}</div>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>식재료: {selectedVersionManual.ingredients?.length || 0}개</span>
                      <span>판매가: ${selectedVersionManual.sellingPrice?.toFixed(2) || '-'}</span>
                    </div>
                    {/* Current Version Preview */}
                    {previewVersion === 'current' && (
                      <div className="mt-4 p-3 bg-white border border-green-200 rounded">
                        <h4 className="font-medium text-sm mb-2">현재 버전 내용</h4>
                        <div className="text-xs space-y-2">
                          <div><strong>메뉴명:</strong> {selectedVersionManual.name} / {selectedVersionManual.koreanName}</div>
                          <div><strong>Shelf Life:</strong> {selectedVersionManual.shelfLife || '-'}</div>
                          <div><strong>판매가:</strong> ${selectedVersionManual.sellingPrice?.toFixed(2) || '-'}</div>
                          <div><strong>식재료 ({selectedVersionManual.ingredients?.length || 0}개):</strong></div>
                          <ul className="ml-4 list-disc">
                            {selectedVersionManual.ingredients?.slice(0, 5).map((ing: any, i: number) => (
                              <li key={i}>{ing.name || ing.koreanName} - {ing.quantity} {ing.unit}</li>
                            ))}
                            {(selectedVersionManual.ingredients?.length || 0) > 5 && <li>... 외 {selectedVersionManual.ingredients!.length - 5}개</li>}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Previous Versions */}
                  {versionHistory?.versions?.map((ver: any, verIndex: number) => {
                    // Calculate differences from current version
                    const currentIngCount = selectedVersionManual.ingredients?.length || 0;
                    const verIngCount = ver.ingredients?.length || 0;
                    const ingDiff = currentIngCount - verIngCount;
                    const priceDiff = (selectedVersionManual.sellingPrice || 0) - (ver.sellingPrice || 0);
                    
                    // Find added/removed ingredients
                    const currentIngNames = selectedVersionManual.ingredients?.map((i: any) => i.name || i.koreanName) || [];
                    const verIngNames = ver.ingredients?.map((i: any) => i.name || i.koreanName) || [];
                    const addedIngs = currentIngNames.filter((n: string) => !verIngNames.includes(n));
                    const removedIngs = verIngNames.filter((n: string) => !currentIngNames.includes(n));
                    
                    return (
                      <div key={ver.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="px-2 py-1 bg-gray-400 text-white text-xs rounded font-medium">이전</span>
                            <span className="ml-2 font-medium">v{ver.version}</span>
                            <span className="ml-2 text-sm text-gray-500">
                              {ver.createdAt ? new Date(ver.createdAt).toLocaleString('ko-KR') : '-'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPreviewVersion(previewVersion === ver.id ? null : ver.id)}
                              className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${previewVersion === ver.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                              <Eye className="w-4 h-4" />
                              미리보기
                            </button>
                            <button
                              onClick={() => handleRestoreVersion(ver.id)}
                              className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
                            >
                              복구
                            </button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="text-sm font-medium">{ver.name}</div>
                          {ver.changeNote && (
                            <div className="text-xs text-gray-500 mt-1">변경 사유: {ver.changeNote}</div>
                          )}
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span>식재료: {verIngCount}개</span>
                            <span>판매가: ${ver.sellingPrice?.toFixed(2) || '-'}</span>
                          </div>
                          
                          {/* Changes from this version to current */}
                          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                            <div className="font-medium text-yellow-800 mb-1">이 버전 이후 변경 내용:</div>
                            <div className="space-y-1 text-yellow-700">
                              {ingDiff !== 0 && (
                                <div>• 식재료: {ingDiff > 0 ? `+${ingDiff}개 추가` : `${Math.abs(ingDiff)}개 삭제`}</div>
                              )}
                              {priceDiff !== 0 && (
                                <div>• 판매가: {priceDiff > 0 ? `+$${priceDiff.toFixed(2)}` : `-$${Math.abs(priceDiff).toFixed(2)}`}</div>
                              )}
                              {addedIngs.length > 0 && (
                                <div className="text-green-600">• 추가된 식재료: {addedIngs.slice(0, 3).join(', ')}{addedIngs.length > 3 ? ` 외 ${addedIngs.length - 3}개` : ''}</div>
                              )}
                              {removedIngs.length > 0 && (
                                <div className="text-red-600">• 삭제된 식재료: {removedIngs.slice(0, 3).join(', ')}{removedIngs.length > 3 ? ` 외 ${removedIngs.length - 3}개` : ''}</div>
                              )}
                              {ingDiff === 0 && priceDiff === 0 && addedIngs.length === 0 && removedIngs.length === 0 && (
                                <div className="text-gray-500">변경 없음</div>
                              )}
                            </div>
                          </div>
                          
                          {/* Version Preview */}
                          {previewVersion === ver.id && (
                            <div className="mt-3 p-3 bg-white border border-blue-200 rounded">
                              <h4 className="font-medium text-sm mb-2">v{ver.version} 내용</h4>
                              <div className="text-xs space-y-2">
                                <div><strong>메뉴명:</strong> {ver.name} / {ver.koreanName}</div>
                                <div><strong>Shelf Life:</strong> {ver.shelfLife || '-'}</div>
                                <div><strong>판매가:</strong> ${ver.sellingPrice?.toFixed(2) || '-'}</div>
                                <div><strong>식재료 ({verIngCount}개):</strong></div>
                                <ul className="ml-4 list-disc max-h-32 overflow-y-auto">
                                  {ver.ingredients?.map((ing: any, i: number) => (
                                    <li key={i}>{ing.name || ing.koreanName} - {ing.quantity} {ing.unit}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => { setShowVersionModal(false); setPreviewVersion(null); }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Modal (Overlay) */}
      {showUploadProgressModal && chunkProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md text-center">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <RefreshCw className="w-16 h-16 text-orange-500 animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">매뉴얼 업로드 중...</h3>
              <p className="text-gray-600">잠시만 기다려주세요</p>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.round((chunkProgress.saved / chunkProgress.total) * 100)}%` }}
                />
              </div>
            </div>
            
            {/* Progress Text */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">진행률</span>
              <span className="font-bold text-orange-600">
                {chunkProgress.saved} / {chunkProgress.total} 완료
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-800">
              {Math.round((chunkProgress.saved / chunkProgress.total) * 100)}%
            </div>
            
            {/* Current item being processed */}
            <p className="mt-4 text-xs text-gray-400">
              처리 중... ({chunkProgress.current}/{chunkProgress.total})
            </p>
          </div>
        </div>
      )}

      {/* Bulk Download Floating Bar */}
      {isMultiSelectMode && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-gray-200 px-6 py-4 z-50 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <CheckCheck className="w-5 h-5 text-orange-500" />
            <span className="font-medium text-gray-700">
              {selectedManualsForDownload.size}개 선택됨
            </span>
          </div>
          
          <div className="h-8 w-px bg-gray-200" />
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkDownloadManuals(Array.from(selectedManualsForDownload), { includeManual: true, includeCost: false })}
              disabled={selectedManualsForDownload.size === 0 || isBulkDownloading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              매뉴얼만
            </button>
            
            <button
              onClick={() => handleBulkDownloadManuals(Array.from(selectedManualsForDownload), { includeManual: false, includeCost: true })}
              disabled={selectedManualsForDownload.size === 0 || isBulkDownloading}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Table className="w-4 h-4" />
              원가만
            </button>
            
            <button
              onClick={() => handleBulkDownloadManuals(Array.from(selectedManualsForDownload), { includeManual: true, includeCost: true })}
              disabled={selectedManualsForDownload.size === 0 || isBulkDownloading}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              매뉴얼+원가
            </button>
          </div>
          
          <div className="h-8 w-px bg-gray-200" />
          
          <button
            onClick={toggleMultiSelectMode}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            취소
          </button>
          
          {isBulkDownloading && (
            <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
              <span className="ml-2 text-gray-600">다운로드 중...</span>
            </div>
          )}
        </div>
      )}

      {/* Create New Template Modal */}
      {showCreateTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-500" />
                새 국가 템플릿 생성
              </h3>
              <button onClick={() => setShowCreateTemplateModal(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">템플릿 이름 *</label>
                <input
                  type="text"
                  value={newTemplateForm.name}
                  onChange={(e) => setNewTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: Honduras Template"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">국가 *</label>
                <input
                  type="text"
                  value={newTemplateForm.country}
                  onChange={(e) => setNewTemplateForm(prev => ({ ...prev, country: e.target.value }))}
                  placeholder="예: Honduras, CA, US..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">통화</label>
                <select
                  value={newTemplateForm.currency}
                  onChange={(e) => setNewTemplateForm(prev => ({ ...prev, currency: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="KRW">KRW (₩)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="CNY">CNY (¥)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="HNL">HNL (L)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={newTemplateForm.description}
                  onChange={(e) => setNewTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="템플릿에 대한 설명..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowCreateTemplateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleCreateNewTemplate}
                disabled={!newTemplateForm.name || !newTemplateForm.country}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 링킹 리뷰 모달 - 전체 매뉴얼 및 식재료 링킹 확인/수정 */}
      {showLinkingReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">🔗 식재료 링킹 리뷰</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {(() => {
                      const isMaster = !linkingReviewTemplateId || linkingReviewTemplateId === 'master' || linkingReviewTemplateId === '' || linkingReviewTemplateId === '__select__';
                      const templateName = isMaster 
                        ? 'Master' 
                        : priceTemplates.find(t => t.id === linkingReviewTemplateId)?.name || linkingReviewTemplateId;
                      
                      // 통계 계산
                      let totalIngredients = 0;
                      let linkedCount = 0;
                      let unlinkedCount = 0;
                      let noPriceCount = 0;
                      
                      linkingReviewManuals.forEach(manual => {
                        (manual.ingredients || []).forEach((ing: any, ingIdx: number) => {
                          totalIngredients++;
                          const editKey = `${manual.id}_${ingIdx}`;
                          const hasEdit = linkingReviewEdits.has(editKey);
                          const currentLinkId = hasEdit ? linkingReviewEdits.get(editKey) : ing.ingredientId;
                          const isLinked = !!currentLinkId;
                          
                          if (isLinked) {
                            linkedCount++;
                            // 가격 확인
                            const linkedMaster = masterIngredientsList.find(m => m.id === currentLinkId);
                            if (!linkedMaster?.unitPrice || linkedMaster.unitPrice === 0) {
                              noPriceCount++;
                            }
                          } else {
                            unlinkedCount++;
                          }
                        });
                      });
                      
                      return (
                        <>
                          <span className="font-medium text-blue-600">[{templateName}]</span> 템플릿의 {linkingReviewManuals.length}개 매뉴얼
                          {totalIngredients > 0 && (
                            <span className="ml-2">
                              | 총 {totalIngredients}개 식재료
                              {unlinkedCount > 0 && <span className="text-red-600 font-medium ml-1">({unlinkedCount}개 미링킹)</span>}
                              {noPriceCount > 0 && <span className="text-orange-500 font-medium ml-1">({noPriceCount}개 미가격)</span>}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* 뷰 필터 드롭다운 */}
                  <select
                    value={linkingReviewViewFilter}
                    onChange={(e) => setLinkingReviewViewFilter(e.target.value as 'all' | 'linked' | 'unlinked')}
                    className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="all">전체보기</option>
                    <option value="linked">링킹 완료만</option>
                    <option value="unlinked">미링킹/미가격만</option>
                  </select>
                  
                  {/* 일괄 링킹 검색 UI */}
                  <div className="relative flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="식재료명으로 검색하여 일괄 링킹..."
                        value={bulkLinkSearchTerm}
                        onChange={(e) => {
                          setBulkLinkSearchTerm(e.target.value);
                          setBulkLinkSelectedItems(new Set());
                          setShowBulkLinkMasterSelect(false);
                          setBulkLinkTargetMaster(null);
                        }}
                        className="pl-9 pr-3 py-2 w-72 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    {/* 검색 결과 표시 및 체크박스 */}
                    {bulkLinkSearchTerm.length > 0 && (
                      <div className="flex items-center gap-2">
                        {(() => {
                          // 검색어로 매뉴얼 식재료 필터링
                          const matchingItems: { editKey: string; ing: any; manualName: string }[] = [];
                          linkingReviewManuals.forEach((manual) => {
                            (manual.ingredients || []).forEach((ing: any, ingIdx: number) => {
                              const editKey = `${manual.id}_${ingIdx}`;
                              const ingName = (ing.name || '').toLowerCase();
                              const ingKorName = (ing.koreanName || '').toLowerCase();
                              const searchLower = bulkLinkSearchTerm.toLowerCase();
                              if (ingName.includes(searchLower) || ingKorName.includes(searchLower)) {
                                matchingItems.push({ editKey, ing, manualName: manual.name });
                              }
                            });
                          });
                          
                          if (matchingItems.length === 0) {
                            return <span className="text-sm text-gray-400">일치하는 식재료 없음</span>;
                          }
                          
                          const allSelected = matchingItems.every(item => bulkLinkSelectedItems.has(item.editKey));
                          
                          return (
                            <>
                              <span className="text-sm text-gray-600">
                                {matchingItems.length}개 발견
                              </span>
                              <button
                                onClick={() => {
                                  if (allSelected) {
                                    setBulkLinkSelectedItems(new Set());
                                  } else {
                                    setBulkLinkSelectedItems(new Set(matchingItems.map(item => item.editKey)));
                                  }
                                }}
                                className={`px-3 py-1.5 text-sm rounded-lg ${allSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'} hover:bg-blue-200`}
                              >
                                {allSelected ? '선택 해제' : '모두 선택'}
                              </button>
                              {bulkLinkSelectedItems.size > 0 && (
                                <div className="relative">
                                  <button
                                    onClick={() => setShowBulkLinkMasterSelect(!showBulkLinkMasterSelect)}
                                    className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-1"
                                  >
                                    <CheckCheck className="w-4 h-4" />
                                    {bulkLinkSelectedItems.size}개 일괄 링킹
                                  </button>
                                  {/* 마스터 식재료 선택 드롭다운 */}
                                  {showBulkLinkMasterSelect && (
                                    <div className="absolute top-full right-0 mt-1 w-80 bg-white border rounded-lg shadow-lg z-50 max-h-72 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                                      <div className="p-2 border-b">
                                        <input
                                          type="text"
                                          placeholder="마스터 식재료 검색..."
                                          value={bulkLinkMasterSearchTerm}
                                          onChange={(e) => setBulkLinkMasterSearchTerm(e.target.value)}
                                          className="w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-green-400"
                                          autoFocus
                                        />
                                      </div>
                                      <div className="overflow-y-auto flex-1 max-h-48">
                                        {masterIngredientsList
                                          .filter(m => 
                                            !bulkLinkMasterSearchTerm ||
                                            m.englishName?.toLowerCase().includes(bulkLinkMasterSearchTerm.toLowerCase()) ||
                                            m.koreanName?.toLowerCase().includes(bulkLinkMasterSearchTerm.toLowerCase())
                                          )
                                          .slice(0, 30)
                                          .map(master => (
                                            <button
                                              key={master.id}
                                              onClick={() => {
                                                // 선택된 모든 아이템에 이 마스터를 링킹
                                                setLinkingReviewEdits(prev => {
                                                  const newMap = new Map(prev);
                                                  bulkLinkSelectedItems.forEach(editKey => {
                                                    newMap.set(editKey, master.id);
                                                  });
                                                  return newMap;
                                                });
                                                // 초기화
                                                setBulkLinkSearchTerm('');
                                                setBulkLinkSelectedItems(new Set());
                                                setShowBulkLinkMasterSelect(false);
                                                setBulkLinkMasterSearchTerm('');
                                              }}
                                              className="w-full px-3 py-2 text-left hover:bg-green-50 text-sm border-b"
                                            >
                                              <div className="font-medium text-gray-900">{master.englishName}</div>
                                              {master.koreanName && (
                                                <div className="text-xs text-gray-500">{master.koreanName}</div>
                                              )}
                                            </button>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* 판매가 일괄 설정 버튼 */}
                              {bulkLinkSelectedItems.size > 0 && (
                                <div className="relative">
                                  <button
                                    onClick={() => setShowBulkPriceInput(!showBulkPriceInput)}
                                    className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-1"
                                  >
                                    <DollarSign className="w-4 h-4" />
                                    판매가 설정
                                  </button>
                                  {/* 판매가 입력 드롭다운 */}
                                  {showBulkPriceInput && (
                                    <div className="absolute top-full right-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-50 p-3" onClick={(e) => e.stopPropagation()}>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        선택된 매뉴얼의 판매가 설정
                                      </label>
                                      <div className="flex gap-2">
                                        <div className="flex-1 flex items-center border rounded-lg overflow-hidden">
                                          <span className="px-2 bg-gray-50 text-gray-500">$</span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={bulkPriceValue}
                                            onChange={(e) => setBulkPriceValue(e.target.value)}
                                            className="flex-1 px-2 py-1.5 text-sm focus:outline-none"
                                            autoFocus
                                          />
                                        </div>
                                        <button
                                          onClick={() => {
                                            const price = parseFloat(bulkPriceValue);
                                            if (!isNaN(price) && price >= 0) {
                                              // 선택된 아이템의 manualId 추출하여 판매가 설정
                                              const manualIds = new Set<string>();
                                              bulkLinkSelectedItems.forEach(editKey => {
                                                const [manualId] = editKey.split('_');
                                                manualIds.add(manualId);
                                              });
                                              setLinkingReviewPriceEdits(prev => {
                                                const newMap = new Map(prev);
                                                manualIds.forEach(manualId => {
                                                  newMap.set(manualId, price);
                                                });
                                                return newMap;
                                              });
                                              // 초기화
                                              setShowBulkPriceInput(false);
                                              setBulkPriceValue('');
                                              setBulkLinkSearchTerm('');
                                              setBulkLinkSelectedItems(new Set());
                                            }
                                          }}
                                          disabled={!bulkPriceValue || isNaN(parseFloat(bulkPriceValue))}
                                          className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                        >
                                          적용
                                        </button>
                                      </div>
                                      <p className="text-xs text-gray-500 mt-2">
                                        {(() => {
                                          const manualIds = new Set<string>();
                                          bulkLinkSelectedItems.forEach(editKey => {
                                            const [manualId] = editKey.split('_');
                                            manualIds.add(manualId);
                                          });
                                          return `${manualIds.size}개 매뉴얼에 적용됩니다`;
                                        })()}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      setShowLinkingReviewModal(false);
                      setLinkingSearchOpen(null);
                      setLinkingSearchQueries(new Map());
                      setBulkLinkSearchTerm('');
                      setBulkLinkSelectedItems(new Set());
                      setShowBulkPriceInput(false);
                      setBulkPriceValue('');
                      setLinkingReviewViewFilter('all');
                      setLinkingReviewNewIngredients(new Map());
                      setShowAddIngredientForManual(null);
                    }} 
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
                  >
                    <X className="w-5 h-5" />
                    나가기
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overflow-x-visible p-6" onClick={() => setLinkingSearchOpen(null)}>
              {linkingReviewLoading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="ml-3 text-gray-500">로딩 중...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {linkingReviewManuals
                    // 뷰 필터 적용: 매뉴얼 레벨
                    .filter(manual => {
                      if (linkingReviewViewFilter === 'all') return true;
                      
                      const ings = manual.ingredients || [];
                      const hasUnlinkedOrNoPrice = ings.some((ing: any, ingIdx: number) => {
                        const editKey = `${manual.id}_${ingIdx}`;
                        const hasEdit = linkingReviewEdits.has(editKey);
                        const currentLinkId = hasEdit ? linkingReviewEdits.get(editKey) : ing.ingredientId;
                        const isLinked = !!currentLinkId;
                        if (!isLinked) return true;
                        const linkedMaster = masterIngredientsList.find(m => m.id === currentLinkId);
                        if (!linkedMaster?.unitPrice || linkedMaster.unitPrice === 0) return true;
                        return false;
                      });
                      
                      if (linkingReviewViewFilter === 'linked') {
                        // 링킹 완료된 것만 보기: 모든 식재료가 링킹되고 가격 있는 매뉴얼
                        return !hasUnlinkedOrNoPrice && ings.length > 0;
                      } else if (linkingReviewViewFilter === 'unlinked') {
                        // 미링킹/미가격만 보기: 하나라도 미링킹 또는 미가격인 매뉴얼
                        return hasUnlinkedOrNoPrice;
                      }
                      return true;
                    })
                    .map((manual, manualIdx) => {
                    const linkedCount = (manual.ingredients || []).filter((ing: any) => ing.ingredientId).length;
                    const totalCount = (manual.ingredients || []).length;
                    const isFullyLinked = linkedCount === totalCount && totalCount > 0;
                    const hasPriceEdit = linkingReviewPriceEdits.has(manual.id);
                    const currentPrice = hasPriceEdit ? linkingReviewPriceEdits.get(manual.id) : (manual.sellingPrice || 0);
                    
                    // 새로 추가된 식재료
                    const newIngredientsForManual = linkingReviewNewIngredients.get(manual.id) || [];
                    
                    return (
                      <div key={manual.id} className="border rounded-lg" style={{ overflow: 'visible' }}>
                        {/* 매뉴얼 헤더 */}
                        <div className={`px-4 py-3 flex items-center justify-between ${isFullyLinked ? 'bg-green-50' : 'bg-yellow-50'}`}>
                          <div className="flex items-center gap-3">
                            {manual.imageUrl && (
                              <img src={manual.imageUrl} alt="" className="w-12 h-12 rounded object-cover" />
                            )}
                            <div>
                              <h3 className="font-bold text-gray-900">{manual.name}</h3>
                              {manual.koreanName && manual.koreanName !== manual.name && (
                                <p className="text-sm text-gray-500">{manual.koreanName}</p>
                              )}
                            </div>
                            {/* 식재료 추가 버튼 */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAddIngredientForManual(showAddIngredientForManual === manual.id ? null : manual.id);
                                }}
                                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                식재료 추가
                              </button>
                              {showAddIngredientForManual === manual.id && (
                                <div className="absolute left-0 top-full mt-1 w-80 bg-white border rounded-lg shadow-lg z-50 p-3" onClick={(e) => e.stopPropagation()}>
                                  <div className="text-sm font-medium text-gray-700 mb-2">새 식재료 추가</div>
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      placeholder="매뉴얼상 식재료명 (수기 입력)"
                                      id={`new-ing-name-${manual.id}`}
                                      className="w-full px-2 py-1.5 text-sm border rounded"
                                    />
                                    <div className="flex gap-2">
                                      <input
                                        type="number"
                                        placeholder="사용량"
                                        id={`new-ing-qty-${manual.id}`}
                                        className="w-20 px-2 py-1.5 text-sm border rounded"
                                      />
                                      <input
                                        type="text"
                                        placeholder="단위"
                                        id={`new-ing-unit-${manual.id}`}
                                        defaultValue="g"
                                        className="w-16 px-2 py-1.5 text-sm border rounded"
                                      />
                                    </div>
                                    <select
                                      id={`new-ing-master-${manual.id}`}
                                      className="w-full px-2 py-1.5 text-sm border rounded"
                                    >
                                      <option value="">마스터 식재료 선택 (선택사항)</option>
                                      {masterIngredientsList.slice(0, 50).map(master => (
                                        <option key={master.id} value={master.id}>
                                          {master.englishName} {master.koreanName ? `(${master.koreanName})` : ''}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => {
                                        const nameEl = document.getElementById(`new-ing-name-${manual.id}`) as HTMLInputElement;
                                        const qtyEl = document.getElementById(`new-ing-qty-${manual.id}`) as HTMLInputElement;
                                        const unitEl = document.getElementById(`new-ing-unit-${manual.id}`) as HTMLInputElement;
                                        const masterEl = document.getElementById(`new-ing-master-${manual.id}`) as HTMLSelectElement;
                                        
                                        if (!nameEl.value) {
                                          alert('식재료명을 입력해주세요.');
                                          return;
                                        }
                                        
                                        const newIng = {
                                          tempId: `temp_${Date.now()}`,
                                          name: nameEl.value,
                                          koreanName: nameEl.value,
                                          quantity: parseFloat(qtyEl.value) || 0,
                                          unit: unitEl.value || 'g',
                                          ingredientId: masterEl.value || null
                                        };
                                        
                                        setLinkingReviewNewIngredients(prev => {
                                          const newMap = new Map(prev);
                                          const existing = newMap.get(manual.id) || [];
                                          newMap.set(manual.id, [...existing, newIng]);
                                          return newMap;
                                        });
                                        
                                        // 입력 초기화
                                        nameEl.value = '';
                                        qtyEl.value = '';
                                        setShowAddIngredientForManual(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                                    >
                                      추가
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {/* 판매가 입력란 */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">판매가:</span>
                              <input
                                type="number"
                                step="0.01"
                                value={currentPrice}
                                onChange={(e) => {
                                  const newPrice = parseFloat(e.target.value) || 0;
                                  setLinkingReviewPriceEdits(prev => {
                                    const newMap = new Map(prev);
                                    if (newPrice === (manual.sellingPrice || 0)) {
                                      newMap.delete(manual.id);
                                    } else {
                                      newMap.set(manual.id, newPrice);
                                    }
                                    return newMap;
                                  });
                                }}
                                className={`w-24 px-2 py-1 text-sm border rounded text-right ${hasPriceEdit ? 'border-blue-500 bg-blue-50' : ''}`}
                                placeholder="0.00"
                              />
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                              isFullyLinked ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {linkedCount}/{totalCount} 링킹
                            </div>
                          </div>
                        </div>

                        {/* 식재료 테이블 */}
                        {((manual.ingredients && manual.ingredients.length > 0) || newIngredientsForManual.length > 0) && (
                          <div className="overflow-visible">
                          <table className="w-full text-sm" style={{ overflow: 'visible' }}>
                            <thead className="bg-gray-100">
                              <tr>
                                {bulkLinkSearchTerm.length > 0 && <th className="px-2 py-2 w-8"></th>}
                                <th className="px-3 py-2 text-left w-10">#</th>
                                <th className="px-3 py-2 text-left w-48">매뉴얼상 식재료명</th>
                                <th className="px-3 py-2 text-left w-48">링킹된 식재료명</th>
                                <th className="px-3 py-2 text-left w-24">사용량</th>
                                <th className="px-3 py-2 text-right w-24">원가</th>
                                <th className="px-3 py-2 text-left min-w-[280px]">변경</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* 기존 식재료 */}
                              {(manual.ingredients || [])
                                // 뷰 필터 적용: 식재료 레벨
                                .filter((ing: any, ingIdx: number) => {
                                  if (linkingReviewViewFilter === 'all') return true;
                                  
                                  const editKey = `${manual.id}_${ingIdx}`;
                                  const hasEdit = linkingReviewEdits.has(editKey);
                                  const currentLinkId = hasEdit ? linkingReviewEdits.get(editKey) : ing.ingredientId;
                                  const isLinked = !!currentLinkId;
                                  const linkedMaster = currentLinkId ? masterIngredientsList.find(m => m.id === currentLinkId) : null;
                                  const hasPrice = linkedMaster?.unitPrice && linkedMaster.unitPrice > 0;
                                  
                                  if (linkingReviewViewFilter === 'linked') {
                                    return isLinked && hasPrice;
                                  } else if (linkingReviewViewFilter === 'unlinked') {
                                    return !isLinked || !hasPrice;
                                  }
                                  return true;
                                })
                                .map((ing: any, ingIdx: number) => {
                                const editKey = `${manual.id}_${ingIdx}`;
                                const hasEdit = linkingReviewEdits.has(editKey);
                                const currentLinkId = hasEdit ? linkingReviewEdits.get(editKey) : ing.ingredientId;
                                const isLinked = hasEdit ? !!currentLinkId : !!ing.ingredientId;
                                const linkedMaster = currentLinkId ? masterIngredientsList.find(m => m.id === currentLinkId) : null;
                                
                                // 일괄 링킹 검색 매칭 확인
                                const ingName = (ing.name || '').toLowerCase();
                                const ingKorName = (ing.koreanName || '').toLowerCase();
                                const searchLower = bulkLinkSearchTerm.toLowerCase();
                                const matchesBulkSearch = bulkLinkSearchTerm.length > 0 && 
                                  (ingName.includes(searchLower) || ingKorName.includes(searchLower));
                                const isSelectedForBulk = bulkLinkSelectedItems.has(editKey);
                                
                                // 사용량 수정 여부 확인
                                const hasQuantityEdit = linkingReviewQuantityEdits.has(editKey);
                                const currentUsageQuantity = hasQuantityEdit 
                                  ? linkingReviewQuantityEdits.get(editKey)!.quantity 
                                  : (parseFloat(ing.quantity) || 0);
                                const currentUsageUnit = hasQuantityEdit 
                                  ? linkingReviewQuantityEdits.get(editKey)!.unit 
                                  : (ing.unit || '');
                                
                                // 원가 계산: (매뉴얼 사용량 / Pricing 기준수량) × Pricing 단가 × 수율 팩터
                                // 예: Pricing에서 1000g에 $10 설정, 매뉴얼에서 100g 사용, 수율 95% → (100/1000) × $10 × (100/95) = $1.05
                                const usageQuantity = currentUsageQuantity; // 수정된 값 또는 원본 값
                                const baseQuantity = linkedMaster?.baseQuantity || linkedMaster?.quantity || 1; // Pricing에서 설정한 기준 용량
                                const unitPrice = linkedMaster?.unitPrice || 0; // Pricing에서 설정한 단가
                                const yieldRate = linkedMaster?.yieldRate || 100; // 수율 (기본값 100%)
                                const yieldFactor = yieldRate > 0 ? (100 / yieldRate) : 1; // 수율 팩터
                                const costPerUsage = baseQuantity > 0 && unitPrice > 0 
                                  ? ((usageQuantity / baseQuantity) * unitPrice) * yieldFactor
                                  : 0;
                                
                                // 검색 관련
                                const searchQuery = linkingSearchQueries.get(editKey) || '';
                                const isSearchOpen = linkingSearchOpen === editKey;
                                const filteredMasters = searchQuery.length > 0 
                                  ? masterIngredientsList.filter(m => 
                                      m.englishName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      m.koreanName?.toLowerCase().includes(searchQuery.toLowerCase())
                                    ).slice(0, 20)
                                  : masterIngredientsList.slice(0, 20);
                                
                                // 일괄 검색 매칭 시 행 숨기지 않고 하이라이트만 표시
                                const rowClasses = `border-t ${
                                  isSelectedForBulk ? 'bg-yellow-100 ring-2 ring-yellow-400' :
                                  matchesBulkSearch ? 'bg-yellow-50' :
                                  !isLinked ? 'bg-red-50' : 
                                  hasEdit ? 'bg-blue-50' : ''
                                }`;
                                
                                return (
                                  <tr key={ingIdx} className={rowClasses}>
                                    {/* 일괄 링킹 검색 중일 때 체크박스 표시 */}
                                    {bulkLinkSearchTerm.length > 0 && (
                                      <td className="px-2 py-2">
                                        {matchesBulkSearch && (
                                          <input
                                            type="checkbox"
                                            checked={isSelectedForBulk}
                                            onChange={(e) => {
                                              setBulkLinkSelectedItems(prev => {
                                                const newSet = new Set(prev);
                                                if (e.target.checked) {
                                                  newSet.add(editKey);
                                                } else {
                                                  newSet.delete(editKey);
                                                }
                                                return newSet;
                                              });
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                                          />
                                        )}
                                      </td>
                                    )}
                                    <td className="px-3 py-2 text-gray-500">{ingIdx + 1}</td>
                                    <td className="px-3 py-2">
                                      <div className={`font-medium ${matchesBulkSearch ? 'text-yellow-700' : ''}`}>{ing.name}</div>
                                      {ing.koreanName && ing.koreanName !== ing.name && (
                                        <div className="text-xs text-gray-500">{ing.koreanName}</div>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      {isLinked && linkedMaster ? (
                                        <div>
                                          <div className="text-green-700 font-medium">{linkedMaster.englishName}</div>
                                          {linkedMaster.koreanName && (
                                            <div className="text-xs text-gray-500">{linkedMaster.koreanName}</div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-red-500 text-sm">❌ 미링킹</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      {/* 사용량 수정 가능 */}
                                      {(() => {
                                        const hasQuantityEdit = linkingReviewQuantityEdits.has(editKey);
                                        const currentQuantity = hasQuantityEdit 
                                          ? linkingReviewQuantityEdits.get(editKey)!.quantity 
                                          : (ing.quantity || 0);
                                        const currentUnit = hasQuantityEdit 
                                          ? linkingReviewQuantityEdits.get(editKey)!.unit 
                                          : (ing.unit || '');
                                        
                                        return (
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={currentQuantity}
                                              onChange={(e) => {
                                                const newQuantity = parseFloat(e.target.value) || 0;
                                                setLinkingReviewQuantityEdits(prev => {
                                                  const newMap = new Map(prev);
                                                  if (newQuantity === (ing.quantity || 0) && currentUnit === (ing.unit || '')) {
                                                    newMap.delete(editKey);
                                                  } else {
                                                    newMap.set(editKey, {
                                                      quantity: newQuantity,
                                                      unit: currentUnit,
                                                      manualIngredientId: ing.id
                                                    });
                                                  }
                                                  return newMap;
                                                });
                                              }}
                                              className={`w-16 px-1.5 py-0.5 text-sm border rounded text-right ${hasQuantityEdit ? 'border-purple-500 bg-purple-50' : 'border-gray-200'} focus:outline-none focus:ring-1 focus:ring-purple-400`}
                                            />
                                            <input
                                              type="text"
                                              value={currentUnit}
                                              onChange={(e) => {
                                                const newUnit = e.target.value;
                                                setLinkingReviewQuantityEdits(prev => {
                                                  const newMap = new Map(prev);
                                                  if (currentQuantity === (ing.quantity || 0) && newUnit === (ing.unit || '')) {
                                                    newMap.delete(editKey);
                                                  } else {
                                                    newMap.set(editKey, {
                                                      quantity: currentQuantity,
                                                      unit: newUnit,
                                                      manualIngredientId: ing.id
                                                    });
                                                  }
                                                  return newMap;
                                                });
                                              }}
                                              className={`w-12 px-1 py-0.5 text-sm border rounded ${hasQuantityEdit ? 'border-purple-500 bg-purple-50' : 'border-gray-200'} focus:outline-none focus:ring-1 focus:ring-purple-400`}
                                              placeholder="단위"
                                            />
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono group relative">
                                      {isLinked && unitPrice > 0 ? (
                                        <>
                                          <span className={`cursor-help ${hasQuantityEdit ? 'text-purple-700' : 'text-gray-700'}`}>${costPerUsage.toFixed(2)}</span>
                                          {/* 원가 계산 툴팁 */}
                                          <div className="absolute right-0 top-full mt-1 bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg z-50 hidden group-hover:block whitespace-nowrap">
                                            ({usageQuantity}{currentUsageUnit || ''} / {baseQuantity}{linkedMaster?.unit || ''}) × ${unitPrice.toFixed(2)} = ${costPerUsage.toFixed(2)}
                                          </div>
                                        </>
                                      ) : isLinked && unitPrice === 0 ? (
                                        <span className="text-orange-500 text-xs" title="Pricing에서 단가를 설정하세요">가격미설정</span>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 relative" style={{ overflow: 'visible' }}>
                                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="text"
                                          placeholder={currentLinkId ? "검색하여 변경..." : "검색하여 링킹..."}
                                          value={isSearchOpen ? searchQuery : (linkedMaster ? `${linkedMaster.englishName}` : '')}
                                          onChange={(e) => {
                                            setLinkingSearchQueries(prev => {
                                              const newMap = new Map(prev);
                                              newMap.set(editKey, e.target.value);
                                              return newMap;
                                            });
                                          }}
                                          onFocus={() => {
                                            setLinkingSearchOpen(editKey);
                                            setLinkingSearchQueries(prev => {
                                              const newMap = new Map(prev);
                                              newMap.set(editKey, '');
                                              return newMap;
                                            });
                                          }}
                                          className={`w-full px-3 py-1.5 text-sm border rounded ${hasEdit ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-blue-400`}
                                        />
                                        {isSearchOpen && (
                                          <div className="absolute left-0 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-80 overflow-y-auto" style={{ zIndex: 9999, minWidth: '300px' }}>
                                            <button
                                              onClick={() => {
                                                setLinkingReviewEdits(prev => {
                                                  const newMap = new Map(prev);
                                                  if (ing.ingredientId === '' || !ing.ingredientId) {
                                                    newMap.delete(editKey);
                                                  } else {
                                                    newMap.set(editKey, '');
                                                  }
                                                  return newMap;
                                                });
                                                setLinkingSearchOpen(null);
                                              }}
                                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 border-b"
                                            >
                                              ✕ 링킹 해제
                                            </button>
                                            {filteredMasters.length > 0 ? (
                                              filteredMasters.map(master => (
                                                <button
                                                  key={master.id}
                                                  onClick={() => {
                                                    setLinkingReviewEdits(prev => {
                                                      const newMap = new Map(prev);
                                                      if (master.id === ing.ingredientId) {
                                                        newMap.delete(editKey);
                                                      } else {
                                                        newMap.set(editKey, master.id);
                                                      }
                                                      return newMap;
                                                    });
                                                    setLinkingSearchOpen(null);
                                                  }}
                                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex justify-between items-center ${
                                                    master.id === currentLinkId ? 'bg-blue-100' : ''
                                                  }`}
                                                >
                                                  <div>
                                                    <div className="font-medium">{master.englishName}</div>
                                                    {master.koreanName && (
                                                      <div className="text-xs text-gray-500">{master.koreanName}</div>
                                                    )}
                                                  </div>
                                                  {master.unitPrice > 0 && (
                                                    <span className="text-xs text-gray-500 ml-2">
                                                      ${master.unitPrice.toFixed(2)}/{master.baseQuantity}{master.unit}
                                                    </span>
                                                  )}
                                                </button>
                                              ))
                                            ) : (
                                              <div className="px-3 py-2 text-sm text-gray-500">
                                                검색 결과 없음
                                              </div>
                                            )}
                                            {masterIngredientsList.length > 10 && searchQuery.length === 0 && (
                                              <div className="px-3 py-2 text-xs text-gray-400 border-t">
                                                검색어를 입력하여 더 찾기...
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                              {/* 새로 추가된 식재료 */}
                              {newIngredientsForManual.map((newIng, newIdx) => {
                                const linkedMaster = newIng.ingredientId ? masterIngredientsList.find(m => m.id === newIng.ingredientId) : null;
                                return (
                                  <tr key={newIng.tempId} className="border-t bg-blue-50">
                                    {bulkLinkSearchTerm.length > 0 && <td className="px-2 py-2"></td>}
                                    <td className="px-3 py-2 text-blue-500 font-medium">+</td>
                                    <td className="px-3 py-2">
                                      <div className="font-medium text-blue-700">{newIng.name}</div>
                                      <div className="text-xs text-blue-500">새로 추가됨</div>
                                    </td>
                                    <td className="px-3 py-2">
                                      {linkedMaster ? (
                                        <div className="text-green-700 font-medium">{linkedMaster.englishName}</div>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">{newIng.quantity} {newIng.unit}</td>
                                    <td className="px-3 py-2 text-right text-gray-400">-</td>
                                    <td className="px-3 py-2">
                                      <button
                                        onClick={() => {
                                          setLinkingReviewNewIngredients(prev => {
                                            const newMap = new Map(prev);
                                            const existing = newMap.get(manual.id) || [];
                                            newMap.set(manual.id, existing.filter(i => i.tempId !== newIng.tempId));
                                            return newMap;
                                          });
                                        }}
                                        className="text-red-500 hover:text-red-700 text-xs"
                                      >
                                        삭제
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          </div>
                        )}

                        {(!manual.ingredients || manual.ingredients.length === 0) && newIngredientsForManual.length === 0 && (
                          <div className="px-4 py-3 text-gray-500 text-sm">
                            식재료 없음
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {linkingReviewManuals.length === 0 && !linkingReviewLoading && (
                    <div className="text-center py-12 text-gray-500">
                      리뷰할 매뉴얼이 없습니다.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex justify-between items-center">
              <div className="text-sm text-gray-500 flex gap-4">
                {linkingReviewEdits.size > 0 && (
                  <span className="text-blue-600 font-medium">
                    🔗 {linkingReviewEdits.size}개 링킹
                  </span>
                )}
                {linkingReviewPriceEdits.size > 0 && (
                  <span className="text-green-600 font-medium">
                    💰 {linkingReviewPriceEdits.size}개 판매가
                  </span>
                )}
                {linkingReviewQuantityEdits.size > 0 && (
                  <span className="text-purple-600 font-medium">
                    📦 {linkingReviewQuantityEdits.size}개 사용량
                  </span>
                )}
                {(() => {
                  let newIngCount = 0;
                  linkingReviewNewIngredients.forEach(arr => { newIngCount += arr.length; });
                  return newIngCount > 0 ? (
                    <span className="text-cyan-600 font-medium">
                      ➕ {newIngCount}개 새 식재료
                    </span>
                  ) : null;
                })()}
                {(linkingReviewEdits.size > 0 || linkingReviewPriceEdits.size > 0 || linkingReviewQuantityEdits.size > 0 || (() => { let c = 0; linkingReviewNewIngredients.forEach(a => c += a.length); return c; })() > 0) && (
                  <span className="text-orange-500 text-xs">
                    ⚠️ 저장하지 않고 나가면 변경사항이 사라집니다
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={saveLinkingReviewChanges}
                  disabled={(linkingReviewEdits.size === 0 && linkingReviewPriceEdits.size === 0 && linkingReviewQuantityEdits.size === 0) || linkingReviewLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {linkingReviewLoading ? '저장 중...' : `저장 (${linkingReviewEdits.size + linkingReviewPriceEdits.size + linkingReviewQuantityEdits.size}개)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 판매가 일괄 수정 모달 */}
      {showBulkPriceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">💰 판매가 일괄 수정</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {countryFilterTemplateId && countryFilterTemplateId !== '__select__' 
                    ? `${priceTemplates.find(t => t.id === countryFilterTemplateId)?.country || '선택한 국가'} 매뉴얼` 
                    : '전체 매뉴얼'}의 판매가를 한번에 수정합니다.
                </p>
              </div>
              <button onClick={() => setShowBulkPriceModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {bulkPriceLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">메뉴명</th>
                      <th className="px-4 py-2 text-left">한글명</th>
                      <th className="px-4 py-2 text-right w-32">현재 판매가</th>
                      <th className="px-4 py-2 text-right w-36">새 판매가</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getGroupManuals().map((manual) => {
                      const hasEdit = bulkPriceEdits.has(manual.id);
                      const currentPrice = hasEdit ? bulkPriceEdits.get(manual.id) : (manual.sellingPrice || 0);
                      
                      return (
                        <tr key={manual.id} className="border-t">
                          <td className="px-4 py-2 font-medium">{manual.name}</td>
                          <td className="px-4 py-2 text-gray-500">{manual.koreanName || '-'}</td>
                          <td className="px-4 py-2 text-right text-gray-600">
                            {manual.sellingPrice ? `$${manual.sellingPrice.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={currentPrice}
                              onChange={(e) => {
                                const newPrice = parseFloat(e.target.value) || 0;
                                setBulkPriceEdits(prev => {
                                  const newMap = new Map(prev);
                                  if (newPrice === (manual.sellingPrice || 0)) {
                                    newMap.delete(manual.id);
                                  } else {
                                    newMap.set(manual.id, newPrice);
                                  }
                                  return newMap;
                                });
                              }}
                              className={`w-full px-2 py-1 text-sm border rounded text-right ${hasEdit ? 'border-blue-500 bg-blue-50' : ''}`}
                              placeholder="0.00"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {bulkPriceEdits.size > 0 && (
                  <span className="text-green-600 font-medium">
                    {bulkPriceEdits.size}개 변경
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setBulkPriceEdits(new Map());
                    setShowBulkPriceModal(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={saveBulkPriceChanges}
                  disabled={bulkPriceEdits.size === 0 || bulkPriceLoading}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  저장 ({bulkPriceEdits.size}개)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리 일괄 설정 모달 */}
      {showCategoryAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">📁 카테고리 설정</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedManualsForCategory.size}개 매뉴얼에 카테고리를 설정합니다.
                </p>
              </div>
              <button onClick={() => setShowCategoryAssignModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 선택</label>
                <select
                  value={categoryAssignValue}
                  onChange={(e) => setCategoryAssignValue(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">카테고리 선택...</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">또는 새 카테고리 입력</label>
                <input
                  type="text"
                  value={categoryAssignValue}
                  onChange={(e) => setCategoryAssignValue(e.target.value)}
                  placeholder="새 카테고리 이름..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">
                <p className="font-medium mb-1">선택된 매뉴얼:</p>
                <p className="text-gray-600">
                  {savedManuals
                    .filter(m => selectedManualsForCategory.has(m.id))
                    .slice(0, 5)
                    .map(m => m.koreanName || m.name)
                    .join(', ')}
                  {selectedManualsForCategory.size > 5 && ` 외 ${selectedManualsForCategory.size - 5}개`}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
              <button
                onClick={() => {
                  setCategoryAssignValue('');
                  handleBulkCategoryAssign(); // 카테고리 해제
                }}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
              >
                카테고리 해제
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowCategoryAssignModal(false);
                    setCategoryAssignValue('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleBulkCategoryAssign}
                  disabled={!categoryAssignValue}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  설정
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



