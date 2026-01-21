import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ============== 날짜 처리 유틸리티 ==============

/**
 * 다양한 형식의 날짜를 Date 객체로 정규화
 * string | Date | null | undefined -> Date | null
 */
export function normalizeDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }
  try {
    const parsed = parseISO(date);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * 날짜가 과거인지 확인
 */
export function isDatePast(date: string | Date | null | undefined): boolean {
  const normalized = normalizeDate(date);
  if (!normalized) return false;
  return normalized < new Date();
}

/**
 * 안전한 날짜 문자열 변환
 */
export function safeToISOString(date: string | Date | null | undefined): string | null {
  const normalized = normalizeDate(date);
  return normalized ? normalized.toISOString() : null;
}

// ============== 상태 색상 매핑 ==============

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
export type StoreStatus = 'PLANNING' | 'CONSTRUCTION' | 'HIRING' | 'TRAINING' | 'OPEN' | 'ON_HOLD' | 'CLOSED';

export const TASK_STATUS_COLORS: Record<TaskStatus, { bg: string; text: string; border: string }> = {
  TODO: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  BLOCKED: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  DONE: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300' },
};

export const STORE_STATUS_COLORS: Record<StoreStatus, { bg: string; text: string }> = {
  PLANNING: { bg: 'bg-gray-100', text: 'text-gray-700' },
  CONSTRUCTION: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  HIRING: { bg: 'bg-purple-100', text: 'text-purple-700' },
  TRAINING: { bg: 'bg-blue-100', text: 'text-blue-700' },
  OPEN: { bg: 'bg-green-100', text: 'text-green-700' },
  ON_HOLD: { bg: 'bg-orange-100', text: 'text-orange-700' },
  CLOSED: { bg: 'bg-red-100', text: 'text-red-700' },
};

export const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  LOW: { bg: 'bg-gray-100', text: 'text-gray-600' },
  MEDIUM: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-700' },
  URGENT: { bg: 'bg-red-100', text: 'text-red-700' },
};

// ============== API 요청 유틸리티 ==============

export interface ApiError {
  message: string;
  status: number;
  details?: string;
}

/**
 * 에러 처리가 포함된 fetch wrapper
 */
export async function fetchApi<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: ApiError | null }> {
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        data: null,
        error: {
          message: errorData.error || `Request failed with status ${res.status}`,
          status: res.status,
          details: errorData.details,
        },
      };
    }

    const data = await res.json();
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'Network error',
        status: 0,
      },
    };
  }
}

// ============== 숫자 처리 유틸리티 ==============

/**
 * 안전한 숫자 파싱 (NaN 방지)
 */
export function safeParseFloat(value: string | number | null | undefined, defaultValue = 0): number {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'number') return isNaN(value) ? defaultValue : value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 안전한 정수 파싱
 */
export function safeParseInt(value: string | number | null | undefined, defaultValue = 0): number {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'number') return isNaN(value) ? Math.floor(value) : defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 통화 포맷팅
 */
export function formatCurrency(amount: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(amount);
}
