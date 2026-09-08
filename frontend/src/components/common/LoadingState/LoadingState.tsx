import React from 'react';
import { cn } from '../../../utils/cn';

export interface LoadingStateProps {
  message?: string;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message,
  text,
  size = 'md',
  className,
}) => {
  const displayMsg = text || message || 'Loading data...';
  const spinnerDimension = size === 'sm' ? '20px' : size === 'lg' ? '40px' : '32px';
  return (
    <div
      className={cn('loading-state', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-12) var(--space-6)',
        gap: 'var(--space-3)',
      }}
    >
      <div
        style={{
          width: spinnerDimension,
          height: spinnerDimension,
          border: '3px solid var(--color-primary-light, #e0e7ff)',
          borderTopColor: 'var(--color-primary, #3F438F)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        {displayMsg}
      </p>
    </div>
  );
};
