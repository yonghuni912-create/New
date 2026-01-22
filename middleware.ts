import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // 인증된 사용자만 접근 가능
    if (!token) {
      // API 요청인 경우 401 반환
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      // 페이지 요청인 경우 로그인으로 리다이렉트
      return NextResponse.redirect(new URL('/login', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// 보호할 경로 설정
export const config = {
  matcher: [
    // Dashboard 및 하위 모든 페이지
    '/dashboard/:path*',
    // API 라우트 (인증 관련 제외)
    '/api/((?!auth|health).*)',
  ],
};
