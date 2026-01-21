// ============== 공통 타입 정의 ==============

// Task 관련 타입
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  storeId: string;
  phaseId?: string | null;
  templateTaskId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  assigneeId?: string | null;
  dueDate?: string | Date | null;
  startDate?: string | Date | null;
  completedAt?: string | Date | null;
  orderIndex: number;
  blockedReason?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  assignee?: User | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  user?: User;
}

// Store 관련 타입
export type StoreStatus = 'PLANNING' | 'CONSTRUCTION' | 'HIRING' | 'TRAINING' | 'OPEN' | 'ON_HOLD' | 'CLOSED';

export interface Store {
  id: string;
  storeCode: string;
  storeName: string;
  countryId: string;
  country: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  franchiseeEmail?: string | null;
  franchiseeName?: string | null;
  franchiseePhone?: string | null;
  status: StoreStatus;
  plannedOpenDate?: string | Date | null;
  actualOpenDate?: string | Date | null;
  estimatedRevenue?: number | null;
  initialInvestment?: number | null;
  notes?: string | null;
  timezone?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  tasks?: Task[];
  files?: StoreFile[];
}

export interface StoreFile {
  id: string;
  storeId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  category?: string | null;
  description?: string | null;
  uploadedById?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// User 관련 타입
export type UserRole = 'MASTER_ADMIN' | 'ADMIN' | 'PM' | 'CONTRIBUTOR' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

// Manual 관련 타입
export interface MenuManual {
  id: string;
  name: string;
  koreanName?: string | null;
  imageUrl?: string | null;
  shelfLife?: string | null;
  yield?: number | null;
  yieldUnit?: string | null;
  sellingPrice?: number | null;
  notes?: string | null;
  cookingMethod?: string | CookingStep[] | null;
  isActive: boolean;
  isArchived: boolean;
  deletedAt?: string | Date | null;
  deletedBy?: string | null;
  groupId?: string | null;
  priceTemplateId?: string | null;
  isMaster: boolean;
  masterManualId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  ingredients?: ManualIngredient[];
  priceTemplate?: PriceTemplate | null;
  linkingStats?: LinkingStats;
  processStats?: ProcessStats;
}

export interface CookingStep {
  process: string;
  manual: string;
  translatedManual?: string;
}

export interface ManualIngredient {
  id: string;
  manualId: string;
  ingredientId?: string | null;
  name: string;
  koreanName?: string | null;
  quantity: number;
  unit: string;
  section: string;
  sortOrder: number;
  notes?: string | null;
  unitPrice?: number | null;
  baseQuantity?: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  ingredientMaster?: IngredientMaster | null;
}

export interface LinkingStats {
  total: number;
  linked: number;
  unlinked: number;
  isFullyLinked: boolean;
  hasUnlinked: boolean;
}

export interface ProcessStats {
  total: number;
  assigned: number;
  unassigned: number;
  isFullyAssigned: boolean;
}

// Ingredient 관련 타입
export interface IngredientMaster {
  id: string;
  category: string;
  koreanName: string;
  englishName: string;
  quantity: number;
  unit: string;
  yieldRate: number;
  imageUrl?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// Price Template 관련 타입
export interface PriceTemplate {
  id: string;
  name: string;
  country: string;
  region?: string | null;
  currency: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  items?: PriceTemplateItem[];
}

export interface PriceTemplateItem {
  id: string;
  priceTemplateId: string;
  ingredientMasterId: string;
  unitPrice: number;
  packagingUnit?: string | null;
  packagingQty?: number | null;
  notes?: string | null;
  localEnglishName?: string | null;
  localKoreanName?: string | null;
  localQuantity?: number | null;
  localUnit?: string | null;
  localYieldRate?: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  ingredientMaster?: IngredientMaster;
}

// Notification 관련 타입
export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'TASK_ASSIGNED' | 'TASK_UPDATED' | 'STORE_STATUS_CHANGE';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  linkUrl?: string | null;
  createdAt: string | Date;
}

// Inventory 관련 타입
export interface InventoryGroup {
  id: string;
  name: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: { periods: number };
}

export interface InventoryPeriod {
  id: string;
  groupId: string;
  startDate: string | Date;
  endDate: string | Date;
  status: string;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  group?: InventoryGroup;
  items?: InventoryItem[];
}

export interface InventoryItem {
  id: string;
  inventoryPeriodId: string;
  ingredientMasterId: string;
  openingStock: number;
  stockIn: number;
  wastage: number;
  actualClosingStock: number;
  totalUsage?: number | null;
  theoreticalUsage?: number | null;
  variance?: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  ingredient?: IngredientMaster;
}

// API Response 타입
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
