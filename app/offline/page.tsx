'use client';

import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-gray-200 rounded-full flex items-center justify-center mb-6">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            오프라인 상태입니다
          </h1>
          <p className="text-gray-600 mb-6">
            인터넷 연결이 끊어졌습니다. 일부 기능이 제한될 수 있습니다.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
          >
            다시 시도
          </button>
          <p className="text-sm text-gray-500">
            캐시된 페이지는 계속 볼 수 있습니다
          </p>
        </div>

        <div className="mt-12 pt-8 border-t">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            오프라인에서 가능한 작업
          </h2>
          <ul className="text-sm text-gray-500 space-y-2">
            <li>• 이전에 방문한 페이지 보기</li>
            <li>• 캐시된 매장/타스크 정보 확인</li>
            <li>• 변경사항은 온라인 복구 시 동기화됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
