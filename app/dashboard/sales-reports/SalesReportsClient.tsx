'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  Mail,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
} from 'lucide-react';

interface EmailReportSummary {
  id: number;
  report_date: string;
  subject: string;
  sent_at: string;
  success: boolean;
  total_sales: string | null;
  total_orders: number | null;
  sales_dod_pct: string | null;
}

interface ReportDetail {
  report: {
    id: number;
    report_date: string;
    subject: string;
    html_content: string;
    recipients: string;
    sent_at: string;
    success: boolean;
    error_message: string | null;
  };
  charts: { chart_name: string; image_url: string }[];
}

export default function SalesReportsClient() {
  const [reports, setReports] = useState<EmailReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // 모달 상태
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/sales-reports?page=${page}&pageSize=15`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to fetch reports');
      }
      
      setReports(data.reports);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [page]);

  // 리포트 목록 로드
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // 리포트 상세 로드
  const openReportDetail = async (reportId: number) => {
    setModalLoading(true);
    setShowModal(true);
    
    try {
      const res = await fetch(`/api/sales-reports/${reportId}?includeCharts=true`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch report detail');
      }
      
      setSelectedReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
      setShowModal(false);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedReport(null);
  };

  // DoD % 색상 결정
  const getDodColor = (dodPct: string | null) => {
    if (!dodPct) return 'text-gray-500';
    const value = parseFloat(dodPct);
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  // DoD 아이콘
  const getDodIcon = (dodPct: string | null) => {
    if (!dodPct) return null;
    const value = parseFloat(dodPct);
    if (value > 0) return <TrendingUp className="h-4 w-4" />;
    if (value < 0) return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  if (loading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading reports...</span>
      </div>
    );
  }

  if (error && reports.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-800">Failed to Load Reports</h3>
        <p className="text-red-600 mt-2">{error}</p>
        <button
          onClick={fetchReports}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 리포트 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Sales
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Orders
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                DoD Change
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sent At
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="font-medium text-gray-900">
                      {format(new Date(report.report_date), 'MMM dd, yyyy')}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {report.success ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Sent
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <XCircle className="h-4 w-4 mr-1" />
                      Failed
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  {report.total_sales || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {report.total_orders?.toLocaleString() || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center text-sm font-medium ${getDodColor(report.sales_dod_pct)}`}>
                    {getDodIcon(report.sales_dod_pct)}
                    <span className="ml-1">{report.sales_dod_pct || '-'}</span>
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(report.sent_at), 'HH:mm')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => openReportDetail(report.id)}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Page <span className="font-medium">{page}</span> of{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 리포트 상세 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-2 sm:p-4">
            {/* 백드롭 */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={closeModal}
            />

            {/* 모달 컨텐츠 - 더 넓은 가로 너비 */}
            <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-[95vw] xl:max-w-[1400px]">
              {modalLoading ? (
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="ml-2 text-gray-600">Loading report...</span>
                </div>
              ) : selectedReport ? (
                <>
                  {/* 모달 헤더 - 간소화된 슬림한 디자인 */}
                  <div className="bg-white px-4 py-2 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-red-500" />
                      <span className="font-semibold text-gray-900">
                        [BBQ Brand Pulse] {selectedReport.report.report_date} Sales Report
                      </span>
                      
                      {/* 날짜 선택 드롭다운 */}
                      <div className="relative">
                        <button
                          onClick={() => setShowDateDropdown(!showDateDropdown)}
                          className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
                        >
                          <Calendar className="h-4 w-4" />
                          {format(new Date(selectedReport.report.report_date), 'yyyy-MM-dd')}
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        
                        {showDateDropdown && (
                          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto min-w-[160px]">
                            {reports.map((r) => (
                              <button
                                key={r.id}
                                onClick={() => {
                                  setShowDateDropdown(false);
                                  openReportDetail(r.id);
                                }}
                                className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                                  r.report_date === selectedReport.report.report_date
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-gray-700'
                                }`}
                              >
                                {format(new Date(r.report_date), 'yyyy-MM-dd')}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={closeModal}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* 이메일 HTML 내용 - 더 넓은 뷰 영역 */}
                  <div className="p-4 max-h-[85vh] overflow-y-auto bg-gray-50">
                    <div
                      className="email-content bg-white rounded-lg shadow-sm p-4"
                      dangerouslySetInnerHTML={{ __html: selectedReport.report.html_content }}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* 이메일 HTML 스타일 오버라이드 */}
      <style jsx global>{`
        .email-content {
          font-family: Arial, sans-serif;
        }
        .email-content img {
          max-width: 100%;
          height: auto;
        }
        .email-content table {
          border-collapse: collapse;
          width: 100%;
        }
        .email-content td, .email-content th {
          padding: 8px;
          border: 1px solid #ddd;
        }
      `}</style>
    </>
  );
}
