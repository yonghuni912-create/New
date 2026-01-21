import { NextResponse } from 'next/server';

export interface StandardApiError {
  error: string;
  code?: string;
  details?: string;
  timestamp: string;
}

export interface StandardApiSuccess<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * 표준화된 에러 응답 생성
 */
export function apiError(
  message: string,
  status: number = 500,
  details?: string,
  code?: string
): NextResponse<StandardApiError> {
  console.error(`[API Error] ${status}: ${message}`, details ? `- ${details}` : '');
  
  return NextResponse.json(
    {
      error: message,
      code,
      details: process.env.NODE_ENV === 'development' ? details : undefined,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * 표준화된 성공 응답 생성
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse<StandardApiSuccess<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * 에러를 안전하게 문자열로 변환
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * 에러 스택을 안전하게 추출 (개발 환경용)
 */
export function getErrorStack(error: unknown): string | undefined {
  if (process.env.NODE_ENV !== 'development') {
    return undefined;
  }
  if (error instanceof Error) {
    return error.stack?.split('\n').slice(0, 5).join('\n');
  }
  return undefined;
}

// 표준 에러 응답 헬퍼들
export const ApiErrors = {
  unauthorized: () => apiError('Unauthorized', 401, undefined, 'UNAUTHORIZED'),
  forbidden: (detail?: string) => apiError('Permission denied', 403, detail, 'FORBIDDEN'),
  notFound: (entity: string = 'Resource') => apiError(`${entity} not found`, 404, undefined, 'NOT_FOUND'),
  badRequest: (message: string) => apiError(message, 400, undefined, 'BAD_REQUEST'),
  validationError: (message: string) => apiError(message, 422, undefined, 'VALIDATION_ERROR'),
  serverError: (error: unknown) => apiError(
    'Internal server error',
    500,
    getErrorMessage(error),
    'INTERNAL_ERROR'
  ),
};
