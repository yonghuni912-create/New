'use client';

import { cn } from '@/lib/utils';

// onClick 등을 받기 위해 HTMLAttributes 확장
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className, ...props }: CardProps) {
  // Card component wrapper
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('p-4 border-b border-gray-100', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }: CardProps) {
  return (
    <h3
      className={cn(
        'text-2xl font-semibold leading-none tracking-tight',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('p-4 border-t border-gray-100', className)} {...props}>
      {children}
    </div>
  );
}

export function CardDescription({ children, className, ...props }: CardProps) {
  return (
    <p className={cn('text-sm text-gray-500', className)} {...props}>
      {children}
    </p>
  );
}
