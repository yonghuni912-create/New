'use client';

import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Download } from 'lucide-react';
import { Button } from './ui/Button';

interface ExcelRow {
  ingredientName: string;
  price: number;
  unit: string;
  vendor?: string;
  effectiveDate?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ExcelPriceUploaderProps {
  templateId?: string;
  countryId?: string;
  onUploadComplete?: (results: { success: number; errors: number }) => void;
}

export default function ExcelPriceUploader({ templateId, countryId, onUploadComplete }: ExcelPriceUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ExcelRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [uploadResult, setUploadResult] = useState<{ success: number; errors: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.csv'))) {
      processFile(droppedFile);
    } else {
      alert('Please upload an Excel (.xlsx) or CSV file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setParsing(true);
    setErrors([]);
    setParsedData([]);
    setUploadResult(null);

    try {
      // For CSV files, we can parse client-side
      if (selectedFile.name.endsWith('.csv')) {
        const text = await selectedFile.text();
        const rows = parseCSV(text);
        const validationErrors = validateData(rows);
        setErrors(validationErrors);
        setParsedData(rows);
      } else {
        // For Excel files, send to server for parsing
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const res = await fetch('/api/ingredients/import', {
          method: 'POST',
          body: formData
        });
        
        if (res.ok) {
          const { data, errors: parseErrors } = await res.json();
          setParsedData(data || []);
          setErrors(parseErrors || []);
        } else {
          throw new Error('Failed to parse file');
        }
      }
    } catch (e) {
      console.error('Failed to process file:', e);
      setErrors([{ row: 0, field: 'file', message: 'Failed to parse file. Please check the format.' }]);
    }
    
    setParsing(false);
  };

  const parseCSV = (text: string): ExcelRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIndex = headers.findIndex(h => h.includes('name') || h.includes('ingredient') || h.includes('품명'));
    const priceIndex = headers.findIndex(h => h.includes('price') || h.includes('가격'));
    const unitIndex = headers.findIndex(h => h.includes('unit') || h.includes('단위'));
    const vendorIndex = headers.findIndex(h => h.includes('vendor') || h.includes('공급자'));
    const dateIndex = headers.findIndex(h => h.includes('date') || h.includes('날짜'));

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      return {
        ingredientName: values[nameIndex] || '',
        price: parseFloat(values[priceIndex]) || 0,
        unit: values[unitIndex] || 'g',
        vendor: vendorIndex >= 0 ? values[vendorIndex] : undefined,
        effectiveDate: dateIndex >= 0 ? values[dateIndex] : undefined
      };
    }).filter(row => row.ingredientName);
  };

  const validateData = (data: ExcelRow[]): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    data.forEach((row, index) => {
      if (!row.ingredientName) {
        errors.push({ row: index + 2, field: 'ingredientName', message: 'Missing ingredient name' });
      }
      if (!row.price || row.price <= 0) {
        errors.push({ row: index + 2, field: 'price', message: 'Invalid price value' });
      }
      if (!row.unit) {
        errors.push({ row: index + 2, field: 'unit', message: 'Missing unit' });
      }
    });

    return errors;
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) return;
    
    setUploading(true);
    try {
      const res = await fetch('/api/ingredients/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          countryId,
          data: parsedData
        })
      });

      if (res.ok) {
        const result = await res.json();
        setUploadResult({ success: result.updated || 0, errors: result.errors || 0 });
        onUploadComplete?.(result);
      } else {
        throw new Error('Upload failed');
      }
    } catch (e) {
      console.error('Upload failed:', e);
      setUploadResult({ success: 0, errors: parsedData.length });
    }
    setUploading(false);
  };

  const downloadTemplate = () => {
    const headers = ['Ingredient Name', 'Price', 'Unit', 'Vendor', 'Effective Date'];
    const example = ['Chicken Breast', '5.99', 'kg', 'Local Supplier', '2025-01-15'];
    const csv = [headers.join(','), example.join(',')].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'price-upload-template.csv';
    a.click();
  };

  const reset = () => {
    setFile(null);
    setParsedData([]);
    setErrors([]);
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Template Download */}
      <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg">
        <div>
          <p className="text-sm font-medium text-blue-800">Need a template?</p>
          <p className="text-xs text-blue-600">Download our CSV template to get started</p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-1" />
          Download Template
        </Button>
      </div>

      {/* Upload Area */}
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-orange-500 bg-orange-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-orange-500' : 'text-gray-400'}`} />
          <p className="text-lg font-medium text-gray-700">
            Drop your Excel or CSV file here
          </p>
          <p className="text-sm text-gray-500 mt-1">
            or click to browse
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Supported formats: .xlsx, .csv
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* File Info */}
          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-green-600" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button onClick={reset} className="p-2 hover:bg-gray-200 rounded">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Parsing Status */}
          {parsing && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
              <span className="ml-3 text-gray-600">Parsing file...</span>
            </div>
          )}

          {/* Validation Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                <AlertCircle className="w-5 h-5" />
                {errors.length} validation error(s) found
              </div>
              <ul className="text-sm text-red-600 space-y-1 max-h-32 overflow-y-auto">
                {errors.slice(0, 10).map((error, idx) => (
                  <li key={idx}>Row {error.row}: {error.message}</li>
                ))}
                {errors.length > 10 && (
                  <li className="font-medium">... and {errors.length - 10} more errors</li>
                )}
              </ul>
            </div>
          )}

          {/* Preview Table */}
          {parsedData.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <p className="font-medium">{parsedData.length} rows ready to upload</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {parsedData.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm">{row.ingredientName}</td>
                        <td className="px-4 py-2 text-sm">${row.price.toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm">{row.unit}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{row.vendor || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 10 && (
                  <div className="px-4 py-2 text-sm text-gray-500 text-center bg-gray-50">
                    ... and {parsedData.length - 10} more rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <div className={`p-4 rounded-lg ${uploadResult.errors > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
              <div className="flex items-center gap-2">
                <CheckCircle className={`w-5 h-5 ${uploadResult.errors > 0 ? 'text-yellow-600' : 'text-green-600'}`} />
                <span className="font-medium">
                  {uploadResult.success} prices updated successfully
                  {uploadResult.errors > 0 && `, ${uploadResult.errors} errors`}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          {!uploadResult && parsedData.length > 0 && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={uploading}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading || errors.length > 0}>
                {uploading ? 'Uploading...' : `Upload ${parsedData.length} Prices`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
