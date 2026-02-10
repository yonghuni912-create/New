'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Trash2, Download, FileSpreadsheet, Plus, CheckCircle } from 'lucide-react';

interface LaunchTemplate {
  id: string;
  orderIndex: number;
  category: string;
  subcategory: string | null;
  title: string;
  durationDays: number;
  daysBeforeOpening: number;
  templateName: string;
}

export default function LaunchTemplatesPage() {
  const { data: session, status } = useSession();
  const [templates, setTemplates] = useState<LaunchTemplate[]>([]);
  const [templateNames, setTemplateNames] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('DEFAULT');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      redirect('/login');
    }
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, selectedTemplate]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`/api/launch-templates?templateName=${selectedTemplate}`);
      const data = await res.json();
      setTemplates(data.templates || []);
      setTemplateNames(data.templateNames || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const templateName = prompt('템플릿 이름을 입력하세요 (예: MEXICO_CITY, CANADA_DEFAULT):', selectedTemplate || 'DEFAULT');
    if (!templateName) return;

    setUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('templateName', templateName);
      formData.append('sheetName', '세부 런칭 스케줄');

      const res = await fetch('/api/launch-templates/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadStatus({ type: 'success', message: `${data.count}개의 타스크 템플릿을 가져왔습니다.` });
        setSelectedTemplate(templateName);
        fetchTemplates();
      } else {
        setUploadStatus({ type: 'error', message: data.error || '업로드에 실패했습니다.' });
      }
    } catch (error) {
      setUploadStatus({ type: 'error', message: '업로드 중 오류가 발생했습니다.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteTemplate = async (templateName: string) => {
    if (!confirm(`"${templateName}" 템플릿을 삭제하시겠습니까?`)) return;

    try {
      // Delete by setting all templates with this name to inactive
      const res = await fetch('/api/launch-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName, tasks: [] }),
      });

      if (res.ok) {
        setUploadStatus({ type: 'success', message: '템플릿이 삭제되었습니다.' });
        if (selectedTemplate === templateName) {
          setSelectedTemplate(templateNames.find(t => t !== templateName) || 'DEFAULT');
        }
        fetchTemplates();
      }
    } catch (error) {
      setUploadStatus({ type: 'error', message: '삭제에 실패했습니다.' });
    }
  };

  // Group templates by category
  const templatesByCategory = templates.reduce<Record<string, LaunchTemplate[]>>((acc, template) => {
    const category = template.category || '기타';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/stores" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">런칭 타스크 템플릿 관리</h1>
            <p className="text-gray-600 mt-1">
              신규 매장 오픈 시 자동 생성될 타스크 템플릿을 관리합니다.
            </p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {uploadStatus && (
        <div className={`p-4 rounded-lg ${uploadStatus.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <div className="flex items-center gap-2">
            {uploadStatus.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <span className="text-red-600">⚠️</span>
            )}
            {uploadStatus.message}
          </div>
        </div>
      )}

      {/* Template Selection and Upload */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">템플릿 선택</label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
            >
              {templateNames.length === 0 ? (
                <option value="DEFAULT">템플릿이 없습니다</option>
              ) : (
                templateNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">엑셀 파일 업로드</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    엑셀에서 가져오기
                  </>
                )}
              </button>
            </div>

            {templateNames.length > 0 && (
              <button
                onClick={() => handleDeleteTemplate(selectedTemplate)}
                className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                삭제
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">엑셀 파일 형식 안내</h4>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>시트 이름: &quot;세부 런칭 스케줄&quot;</li>
            <li>C열: 구분 (카테고리)</li>
            <li>D열: 업무 (세부 분류)</li>
            <li>E열: 세부내용 (타스크 이름)</li>
            <li>F열: 소요기간 (영업일)</li>
            <li>H열: Task Start (오픈일 기준 D-day)</li>
          </ul>
        </div>
      </div>

      {/* Template Contents */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              {selectedTemplate} 템플릿
            </h2>
            <span className="text-sm text-gray-500">{templates.length}개 타스크</span>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>등록된 타스크 템플릿이 없습니다.</p>
            <p className="text-sm mt-2">엑셀 파일을 업로드하여 템플릿을 생성하세요.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
              <div key={category}>
                <div className="px-6 py-3 bg-gray-50">
                  <h3 className="font-bold text-gray-900">{category}</h3>
                  <p className="text-sm text-gray-500">{categoryTemplates.length}개 타스크</p>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">순번</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">세부 분류</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">타스크</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">소요일</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">D-Day</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {categoryTemplates.map((template) => (
                      <tr key={template.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm text-gray-500">{template.orderIndex}</td>
                        <td className="px-6 py-3 text-sm text-gray-500">{template.subcategory || '-'}</td>
                        <td className="px-6 py-3 text-sm text-gray-900">{template.title}</td>
                        <td className="px-6 py-3 text-sm text-gray-500">{template.durationDays}일</td>
                        <td className="px-6 py-3 text-sm text-gray-500">
                          {template.daysBeforeOpening > 0 
                            ? `D-${template.daysBeforeOpening}` 
                            : template.daysBeforeOpening < 0 
                              ? `D+${Math.abs(template.daysBeforeOpening)}`
                              : 'D-Day'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
