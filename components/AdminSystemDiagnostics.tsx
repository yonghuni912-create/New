'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';

interface DbStatus {
  status: string;
  timestamp: string;
  tableCounts: Record<string, number>;
  missingTables: string[];
  dbInfo: { tableCount: number; tables: string[] } | null;
  env: {
    nodeEnv: string;
    hasTursoUrl: boolean;
    hasTursoToken: boolean;
  };
}

export default function AdminSystemDiagnostics() {
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/db-status');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setDbStatus(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const downloadBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch('/api/admin/backup');
      if (!res.ok) throw new Error('Backup failed');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bbq-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Backup failed: ' + String(e));
    } finally {
      setBackupLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'PARTIAL':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  return (
    <section id="diagnostics" className="space-y-6 pt-8 border-t">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span>🔧</span> System Diagnostics
        </h2>
        <div className="flex gap-2">
          <button
            onClick={downloadBackup}
            disabled={backupLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {backupLoading ? 'Creating...' : 'Backup'}
          </button>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error: {error}
        </div>
      )}

      {dbStatus && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Overview */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {getStatusIcon(dbStatus.status)}
              Database Status: {dbStatus.status}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Environment</span>
                <span className="font-medium">{dbStatus.env?.nodeEnv || 'unknown'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Turso URL</span>
                <span className={dbStatus.env?.hasTursoUrl ? 'text-green-600' : 'text-red-600'}>
                  {dbStatus.env?.hasTursoUrl ? '✓ Configured' : '✗ Missing'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Turso Token</span>
                <span className={dbStatus.env?.hasTursoToken ? 'text-green-600' : 'text-red-600'}>
                  {dbStatus.env?.hasTursoToken ? '✓ Configured' : '✗ Missing'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Last Check</span>
                <span className="font-medium">
                  {dbStatus.timestamp ? new Date(dbStatus.timestamp).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Table Counts */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Table Statistics</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.entries(dbStatus.tableCounts || {}).map(([table, count]) => (
                <div key={table} className="flex justify-between text-sm py-1 border-b border-gray-100">
                  <span className="text-gray-600">{table}</span>
                  <span className="font-medium">{count} rows</span>
                </div>
              ))}
              {dbStatus.missingTables?.map((table) => (
                <div key={table} className="flex justify-between text-sm py-1 border-b border-gray-100">
                  <span className="text-red-600">{table}</span>
                  <span className="text-red-500 text-xs">Missing</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Health Endpoints */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Health Check Endpoints</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/api/health"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 border rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
          >
            <div className="font-medium text-gray-900">/api/health</div>
            <div className="text-sm text-gray-500">Basic health check</div>
          </a>
          <a
            href="/api/debug"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 border rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
          >
            <div className="font-medium text-gray-900">/api/debug</div>
            <div className="text-sm text-gray-500">Detailed diagnostics</div>
          </a>
          <a
            href="/api/admin/db-status"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 border rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
          >
            <div className="font-medium text-gray-900">/api/admin/db-status</div>
            <div className="text-sm text-gray-500">Full DB status (admin)</div>
          </a>
        </div>
      </div>
    </section>
  );
}
