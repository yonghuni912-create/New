'use client';

import { LucideIcon, FileX, Database, Search, Plus } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'search' | 'database' | 'no-data';
}

const variantIcons = {
  default: FileX,
  search: Search,
  database: Database,
  'no-data': FileX,
};

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
}: EmptyStateProps) {
  const Icon = icon || variantIcons[variant];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 text-center max-w-sm mb-4">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
