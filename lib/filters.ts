// Filter persistence utilities using localStorage

const FILTER_STORAGE_PREFIX = 'bbq_filters_';

export interface FilterState {
  [key: string]: string | number | boolean | string[] | null;
}

export function saveFilters(pageKey: string, filters: FilterState): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(
      `${FILTER_STORAGE_PREFIX}${pageKey}`,
      JSON.stringify(filters)
    );
  } catch (e) {
    console.error('Failed to save filters:', e);
  }
}

export function loadFilters<T extends FilterState>(
  pageKey: string,
  defaults: T
): T {
  if (typeof window === 'undefined') return defaults;

  try {
    const stored = localStorage.getItem(`${FILTER_STORAGE_PREFIX}${pageKey}`);
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load filters:', e);
  }

  return defaults;
}

export function clearFilters(pageKey: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(`${FILTER_STORAGE_PREFIX}${pageKey}`);
  } catch (e) {
    console.error('Failed to clear filters:', e);
  }
}

export function clearAllFilters(): void {
  if (typeof window === 'undefined') return;

  try {
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith(FILTER_STORAGE_PREFIX)
    );
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.error('Failed to clear all filters:', e);
  }
}

// Hook for using persistent filters
import { useState, useEffect, useCallback } from 'react';

export function usePersistentFilters<T extends FilterState>(
  pageKey: string,
  defaults: T
): [T, (updates: Partial<T>) => void, () => void] {
  const [filters, setFiltersState] = useState<T>(defaults);
  const [initialized, setInitialized] = useState(false);

  // Load filters from localStorage on mount
  useEffect(() => {
    const loaded = loadFilters(pageKey, defaults);
    setFiltersState(loaded);
    setInitialized(true);
  }, [pageKey]);

  // Save filters to localStorage when they change
  useEffect(() => {
    if (initialized) {
      saveFilters(pageKey, filters);
    }
  }, [filters, pageKey, initialized]);

  const setFilters = useCallback((updates: Partial<T>) => {
    setFiltersState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(defaults);
    clearFilters(pageKey);
  }, [pageKey, defaults]);

  return [filters, setFilters, resetFilters];
}
