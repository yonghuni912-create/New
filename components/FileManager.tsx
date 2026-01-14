'use client';

import { useState } from 'react';
import { formatDate, formatFileSize } from '@/lib/utils';
import { Upload, Download, FileText, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface StoreFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  uploadedBy: string;
  createdAt: Date;
}

interface Props {
  storeId: string;
  initialFiles: StoreFile[];
  userId: string;
}

export default function FileManager({ storeId, initialFiles, userId }: Props) {
  const [files, setFiles] = useState(initialFiles);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`/api/stores/${storeId}/files`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }

      const uploadedFile = await response.json();
      setFiles([uploadedFile, ...files]);
      toast.success('File uploaded successfully!');
      
      // Reset the input
      e.target.value = '';
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return '🖼️';
    } else if (fileType === 'application/pdf') {
      return '📄';
    } else if (
      fileType.includes('word') ||
      fileType.includes('document')
    ) {
      return '📝';
    } else if (
      fileType.includes('sheet') ||
      fileType.includes('excel')
    ) {
      return '📊';
    }
    return '📁';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Upload File</h2>
          <p className="text-sm text-gray-500">Max size: 10MB</p>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-orange-500 transition-colors">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 mb-2">
              {isUploading ? (
                'Uploading...'
              ) : (
                <>
                  <span className="font-medium text-orange-600">
                    Click to upload
                  </span>{' '}
                  or drag and drop
                </>
              )}
            </p>
            <p className="text-xs text-gray-500">
              PDF, Images, Word, or Excel files
            </p>
          </label>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Files ({files.length})
          </h2>
        </div>

        {files.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No files uploaded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {files.map((file) => (
              <div
                key={file.id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="text-3xl">{getFileIcon(file.fileType)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.fileSize)} • Uploaded{' '}
                        {formatDate(file.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <a
                      href={file.filePath}
                      download={file.fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-600 hover:text-orange-600 hover:bg-gray-100 rounded-md transition-colors"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
