'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { 
  FileText, 
  User, 
  Calendar, 
  Filter, 
  Search,
  ChevronDown,
  ChevronRight,
  Store,
  ClipboardList,
  DollarSign,
  Settings,
  AlertCircle,
  CheckCircle,
  Edit,
  Trash2,
  Plus
} from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  changes: string; // JSON string
  createdAt: string;
  metadata?: string; // JSON string
}

interface AuditLogViewerProps {
  entityType?: string;
  entityId?: string;
  limit?: number;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CREATE: <Plus className="w-4 h-4 text-green-600" />,
  UPDATE: <Edit className="w-4 h-4 text-blue-600" />,
  DELETE: <Trash2 className="w-4 h-4 text-red-600" />,
  DEFAULT: <FileText className="w-4 h-4 text-gray-600" />
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  STORE: <Store className="w-4 h-4" />,
  TASK: <ClipboardList className="w-4 h-4" />,
  INGREDIENT: <DollarSign className="w-4 h-4" />,
  TEMPLATE: <FileText className="w-4 h-4" />,
  MANUAL: <FileText className="w-4 h-4" />,
  DEFAULT: <Settings className="w-4 h-4" />
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  DEFAULT: 'bg-gray-100 text-gray-800'
};

export default function AuditLogViewer({ entityType, entityId, limit = 50 }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    action: '',
    entityType: entityType || '',
    userId: '',
    startDate: '',
    endDate: ''
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [entityType, entityId, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityType) params.append('entityType', entityType);
      if (entityId) params.append('entityId', entityId);
      if (filters.action) params.append('action', filters.action);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('limit', limit.toString());

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    }
    setLoading(false);
  };

  const parseChanges = (changesStr: string): Record<string, { old: any; new: any }> => {
    try {
      return JSON.parse(changesStr);
    } catch {
      return {};
    }
  };

  const getActionIcon = (action: string) => ACTION_ICONS[action] || ACTION_ICONS.DEFAULT;
  const getEntityIcon = (type: string) => ENTITY_ICONS[type.toUpperCase()] || ENTITY_ICONS.DEFAULT;
  const getActionColor = (action: string) => ACTION_COLORS[action] || ACTION_COLORS.DEFAULT;

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(query) ||
      log.entityType.toLowerCase().includes(query) ||
      log.user.name.toLowerCase().includes(query) ||
      log.user.email.toLowerCase().includes(query)
    );
  });

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="pl-10"
              />
            </div>
          </div>
          
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>

          {!entityType && (
            <select
              value={filters.entityType}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All Types</option>
              <option value="STORE">Store</option>
              <option value="TASK">Task</option>
              <option value="INGREDIENT">Ingredient</option>
              <option value="TEMPLATE">Template</option>
              <option value="MANUAL">Manual</option>
            </select>
          )}

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-36"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-36"
            />
          </div>

          <Button variant="outline" onClick={fetchLogs}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold">{logs.length}</p>
          <p className="text-sm text-gray-500">Total Logs</p>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">
            {logs.filter(l => l.action === 'CREATE').length}
          </p>
          <p className="text-sm text-green-600">Created</p>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">
            {logs.filter(l => l.action === 'UPDATE').length}
          </p>
          <p className="text-sm text-blue-600">Updated</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-700">
            {logs.filter(l => l.action === 'DELETE').length}
          </p>
          <p className="text-sm text-red-600">Deleted</p>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4" />
            Loading audit logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No audit logs found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredLogs.map((log) => {
              const changes = parseChanges(log.changes);
              const isExpanded = expandedLog === log.id;
              
              return (
                <div key={log.id} className="hover:bg-gray-50">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer"
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  >
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getActionIcon(log.action)}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600">
                      {getEntityIcon(log.entityType)}
                      <span className="text-sm">{log.entityType}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-500 truncate">
                        ID: {log.entityId}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <User className="w-4 h-4" />
                      <span>{log.user.name}</span>
                    </div>

                    <div className="text-sm text-gray-400">
                      {format(parseISO(log.createdAt), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>

                  {isExpanded && Object.keys(changes).length > 0 && (
                    <div className="px-4 pb-4 pl-14">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Changes</h4>
                        <div className="space-y-2">
                          {Object.entries(changes).map(([field, change]) => (
                            <div key={field} className="flex items-start gap-4 text-sm">
                              <span className="font-medium text-gray-600 w-32">{field}</span>
                              <div className="flex items-center gap-2">
                                {log.action !== 'CREATE' && (
                                  <>
                                    <span className="text-red-600 line-through">
                                      {formatValue(change.old)}
                                    </span>
                                    <span className="text-gray-400">→</span>
                                  </>
                                )}
                                <span className="text-green-600">
                                  {formatValue(change.new)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
