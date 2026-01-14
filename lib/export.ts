// Export utilities for data download

export interface ExportOptions {
  filename: string;
  format: 'json' | 'csv';
  columns?: string[];
}

export function exportToJSON<T>(data: T[], options: ExportOptions): void {
  const jsonString = JSON.stringify(data, null, 2);
  downloadFile(jsonString, `${options.filename}.json`, 'application/json');
}

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  options: ExportOptions
): void {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  const columns = options.columns || Object.keys(data[0]);
  const header = columns.join(',');
  
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        const value = item[col];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') {
          // Escape quotes and wrap in quotes if contains comma
          const escaped = value.replace(/"/g, '""');
          return escaped.includes(',') || escaped.includes('\n')
            ? `"${escaped}"`
            : escaped;
        }
        return String(value);
      })
      .join(',');
  });

  const csv = [header, ...rows].join('\n');
  downloadFile(csv, `${options.filename}.csv`, 'text/csv');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportData<T extends Record<string, unknown>>(
  data: T[],
  options: ExportOptions
): void {
  if (options.format === 'json') {
    exportToJSON(data, options);
  } else {
    exportToCSV(data, options);
  }
}

// Parse CSV file
export async function parseCSV<T>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter((line) => line.trim());
        
        if (lines.length === 0) {
          resolve([]);
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim());
        const data = lines.slice(1).map((line) => {
          const values = parseCSVLine(line);
          const obj: Record<string, string> = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj as T;
        });

        resolve(data);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Parse JSON file
export async function parseJSON<T>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        resolve(Array.isArray(data) ? data : [data]);
      } catch (error) {
        reject(new Error('Invalid JSON file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
