'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// 페이지당 표시 아이템 수 옵션
export const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100, 'all'] as const;
export type ItemsPerPageOption = typeof ITEMS_PER_PAGE_OPTIONS[number];

// 로컬 스토리지 키 생성 (유저 이메일 + 페이지 키)
const getStorageKey = (userEmail: string, pageKey: string) => 
  `itemsPerPage_${userEmail}_${pageKey}`;

// 기본값
const DEFAULT_ITEMS_PER_PAGE: ItemsPerPageOption = 20;

/**
 * 페이지당 아이템 수를 관리하는 훅
 * - 사용자별로 설정 저장 (localStorage)
 * - 페이지별로 다른 설정 가능
 * 
 * @param pageKey 페이지 식별자 (예: 'templates_manuals', 'pricing_master')
 * @returns [itemsPerPage, setItemsPerPage, itemsPerPageOptions]
 */
export function useItemsPerPage(pageKey: string) {
  const { data: session } = useSession();
  const [itemsPerPage, setItemsPerPageState] = useState<ItemsPerPageOption>(DEFAULT_ITEMS_PER_PAGE);
  const [isLoaded, setIsLoaded] = useState(false);

  // 사용자 이메일 (로그인하지 않은 경우 'guest')
  const userEmail = session?.user?.email || 'guest';

  // 초기 로드: localStorage에서 저장된 값 불러오기
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storageKey = getStorageKey(userEmail, pageKey);
    const savedValue = localStorage.getItem(storageKey);
    
    if (savedValue) {
      const parsed = savedValue === 'all' ? 'all' : parseInt(savedValue, 10);
      if (parsed === 'all' || ITEMS_PER_PAGE_OPTIONS.includes(parsed as any)) {
        setItemsPerPageState(parsed as ItemsPerPageOption);
      }
    }
    setIsLoaded(true);
  }, [userEmail, pageKey]);

  // 값 변경 시 localStorage에 저장
  const setItemsPerPage = useCallback((value: ItemsPerPageOption) => {
    setItemsPerPageState(value);
    
    if (typeof window !== 'undefined') {
      const storageKey = getStorageKey(userEmail, pageKey);
      localStorage.setItem(storageKey, String(value));
    }
  }, [userEmail, pageKey]);

  // 숫자로 변환 (페이지네이션 계산용)
  const getNumericValue = useCallback((totalItems: number): number => {
    if (itemsPerPage === 'all') return totalItems;
    return itemsPerPage;
  }, [itemsPerPage]);

  return {
    itemsPerPage,
    setItemsPerPage,
    isLoaded,
    getNumericValue,
    options: ITEMS_PER_PAGE_OPTIONS,
  };
}

/**
 * 페이지당 아이템 수 선택 드롭다운 라벨
 */
export function getItemsPerPageLabel(value: ItemsPerPageOption): string {
  if (value === 'all') return '전체 보기';
  return `${value}개`;
}
