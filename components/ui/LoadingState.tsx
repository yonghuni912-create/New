'use client';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-16 w-16',
};

export default function LoadingState({
  message = 'Loading...',
  size = 'md',
  inline = false,
}: LoadingStateProps) {
  if (inline) {
    return (
      <div className="inline-flex items-center gap-2">
        <div
          className={`animate-spin rounded-full border-2 border-gray-200 border-t-orange-500 ${sizeClasses[size]}`}
        />
        {message && <span className="text-sm text-gray-500">{message}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div
        className={`animate-spin rounded-full border-4 border-gray-200 border-t-orange-500 ${sizeClasses[size]}`}
      />
      {message && <p className="mt-4 text-gray-500">{message}</p>}
    </div>
  );
}
