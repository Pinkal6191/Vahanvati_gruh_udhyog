import React, { ReactNode } from 'react';
import { PackageOpen } from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface EmptyStateActionConfig {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode | EmptyStateActionConfig;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <PackageOpen size={48} />,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn('empty-state', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-12) var(--space-6)',
        textAlign: 'center',
      }}
    >
      <div style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
        {icon}
      </div>
      <h3
        style={{
          fontSize: 'var(--font-size-md)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-1)',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            maxWidth: '380px',
            marginBottom: action ? 'var(--space-4)' : 0,
          }}
        >
          {description}
        </p>
      )}
      {action && (
        <div>
          {React.isValidElement(action) ? (
            action
          ) : typeof action === 'object' && 'label' in action ? (
            <button
              type="button"
              onClick={(action as EmptyStateActionConfig).onClick}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                backgroundColor: (action as EmptyStateActionConfig).variant === 'outline' ? 'transparent' : 'var(--color-primary, #3F438F)',
                color: (action as EmptyStateActionConfig).variant === 'outline' ? 'var(--color-primary, #3F438F)' : '#ffffff',
                border: (action as EmptyStateActionConfig).variant === 'outline' ? '1px solid var(--color-primary, #3F438F)' : 'none',
                borderRadius: 'var(--radius-md, 6px)',
                fontWeight: 'var(--font-weight-medium, 500)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {(action as EmptyStateActionConfig).label}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};
