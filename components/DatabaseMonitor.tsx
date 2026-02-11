'use client';

import { useState, useEffect } from 'react';
import { Database, RefreshCw, HardDrive, AlertTriangle } from 'lucide-react';

interface StorageInfo {
  usedBytes: number;
  usedMB: number;
  usedGB: number;
  limitBytes: number;
  limitGB: number;
  usagePercent: number;
  rowReadsLimit: number;
}

interface DbStatus {
  status: 'HEALTHY' | 'PARTIAL' | 'NOT_CONFIGURED' | 'ERROR';
  timestamp: string;
  tableCounts: Record<string, number>;
  missingTables: string[];
  dbInfo: { tableCount: number; tables: string[] } | null;
  storageInfo: StorageInfo | null;
  env: {
    nodeEnv: string;
    hasTursoUrl: boolean;
    hasTursoToken: boolean;
  };
  error?: string;
  message?: string;
}

export default function DatabaseMonitor() {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/db-status');
      if (!res.ok) throw new Error('Failed to fetch DB status');
      const data = await res.json();
      setDbStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY': return 'text-green-600 bg-green-100';
      case 'PARTIAL': return 'text-yellow-600 bg-yellow-100';
      case 'NOT_CONFIGURED': return 'text-gray-600 bg-gray-100';
      default: return 'text-red-600 bg-red-100';
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const totalRecords = dbStatus?.tableCounts 
    ? Object.values(dbStatus.tableCounts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          Database Monitor (Turso)
        </h3>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && !dbStatus ? (
        <div className="flex items-center justify-center py-8 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Loading database status...
        </div>
      ) : dbStatus ? (
        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(dbStatus.status)}`}>
              {dbStatus.status}
            </span>
            <span className="text-sm text-gray-500">
              Last checked: {new Date(dbStatus.timestamp).toLocaleString()}
            </span>
          </div>

          {/* Storage Usage */}
          {dbStatus.storageInfo && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-gray-700">Storage Usage</span>
                </div>
                <span className="text-sm font-medium">
                  {dbStatus.storageInfo.usedMB.toFixed(2)} MB / {dbStatus.storageInfo.limitGB} GB
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getProgressColor(dbStatus.storageInfo.usagePercent)}`}
                  style={{ width: `${Math.min(dbStatus.storageInfo.usagePercent, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>{dbStatus.storageInfo.usagePercent.toFixed(2)}% used</span>
                <span>{(dbStatus.storageInfo.limitGB - dbStatus.storageInfo.usedGB).toFixed(3)} GB remaining</span>
              </div>
              {dbStatus.storageInfo.usagePercent >= 80 && (
                <div className="mt-3 flex items-center gap-2 text-amber-600 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Storage usage is high. Consider upgrading to Turso Pro or archiving old data.</span>
                </div>
              )}
            </div>
          )}

          {/* Table Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium">Tables</p>
              <p className="text-2xl font-bold text-blue-900">{dbStatus.dbInfo?.tableCount || 0}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600 font-medium">Total Records</p>
              <p className="text-2xl font-bold text-green-900">{totalRecords.toLocaleString()}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-orange-600 font-medium">Stores</p>
              <p className="text-2xl font-bold text-orange-900">{dbStatus.tableCounts?.Store || 0}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-600 font-medium">Tasks</p>
              <p className="text-2xl font-bold text-purple-900">{dbStatus.tableCounts?.Task || 0}</p>
            </div>
          </div>

          {/* Detailed Table Counts */}
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-2">
              <span className="group-open:rotate-90 transition-transform">▶</span>
              View all table counts
            </summary>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
              {Object.entries(dbStatus.tableCounts || {}).map(([table, count]) => (
                <div key={table} className="flex justify-between px-3 py-2 bg-gray-50 rounded">
                  <span className="text-gray-600">{table}</span>
                  <span className="font-medium">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </details>

          {/* Missing Tables Warning */}
          {dbStatus.missingTables.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-800 font-medium mb-2">
                <AlertTriangle className="w-4 h-4" />
                Missing Tables ({dbStatus.missingTables.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {dbStatus.missingTables.map(table => (
                  <span key={table} className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                    {table}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
