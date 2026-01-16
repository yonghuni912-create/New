# BBQ Franchise Management System - Project Context

## 프로젝트 개요
BBQ 프랜차이즈 관리 시스템 - 매뉴얼 관리, 스토어 관리, 재고 관리 등을 위한 웹 애플리케이션

## 기술 스택
- **Frontend**: Next.js 14.2.35 (App Router)
- **Backend**: Next.js API Routes
- **Database**: Prisma ORM + Turso (SQLite)
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js
- **Excel Parsing**: xlsx (SheetJS)
- **Deployment**: Vercel

## 주요 URL
- **Production**: https://newpro-gamma.vercel.app
- **GitHub**: https://github.com/yonghuni912-create/New

## 다른 노트북에서 설정하는 방법

### 1. 저장소 클론
```bash
git clone https://github.com/yonghuni912-create/New.git
cd New
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env` 파일 생성 (또는 OneDrive에서 동기화됨):
```env
# Database
DATABASE_URL="file:./prisma/dev.db"
TURSO_DATABASE_URL="libsql://your-db.turso.io"
TURSO_AUTH_TOKEN="your-token"

# NextAuth
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# Optional
GOOGLE_TRANSLATE_API_KEY="your-key"
```

### 4. Prisma 설정
```bash
npx prisma generate
npx prisma db push
```

### 5. 개발 서버 실행
```bash
npm run dev
```

## 주요 파일 구조

```
app/
├── dashboard/
│   ├── templates/page.tsx    # 매뉴얼 관리 (Excel 업로드 핵심)
│   ├── stores/               # 스토어 관리
│   └── pricing/              # 가격 템플릿
├── api/
│   ├── manuals/              # 매뉴얼 CRUD API
│   ├── stores/               # 스토어 CRUD API
│   └── audit/                # 감사 로그 API
components/
├── StoreForm.tsx             # 스토어 생성/수정 폼
├── StoreDetailTabs.tsx       # 스토어 상세 탭
prisma/
├── schema.prisma             # DB 스키마
```

## 최근 작업 내역 (2026-01-15)

### 해결된 문제
1. **Excel 조리방법 파싱** 
   - 파일: `app/dashboard/templates/page.tsx`
   - 함수: `parseManualSheet()`
   - PROCESS 열이 비어있어도 MANUAL 열에서 조리 단계 추출

2. **StoreForm 필드명**
   - 파일: `components/StoreForm.tsx`, `components/StoreDetailTabs.tsx`
   - tempName → storeName, officialName 제거

3. **매뉴얼 복구 기능**
   - PUT `/api/manuals/[id]` - isActive/isArchived 업데이트

### 파싱 통계 (BBQ 매뉴얼 파일)
- 파일: `2. 230321_bbqchicken_매뉴얼_.xlsx`
- 총 시트: 86개
- 파싱된 매뉴얼: 83개
- 총 재료: 569개
- 총 조리 단계: 1,410개

## Vercel 배포
```bash
npx vercel --prod
```

## Git 작업
```bash
git add -A
git commit -m "설명"
git push
```

## 테스트 계정
- 관리자: admin / (DB seed에서 설정)

## 주의사항
- `.env` 파일은 Git에 포함되지 않음 - 별도 관리 필요
- Turso DB 토큰은 보안 유지
- Excel 이미지는 자동 추출 불가 (xlsx 라이브러리 제한)

---
*마지막 업데이트: 2026-01-15*
