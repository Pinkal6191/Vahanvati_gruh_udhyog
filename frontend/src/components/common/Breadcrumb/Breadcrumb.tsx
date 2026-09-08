import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  path?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className }) => {
  return (
    <nav className={cn('breadcrumb-nav', className)} aria-label="Breadcrumb">
      <ol style={{ display: 'flex', alignItems: 'center', gap: '6px', listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)' }}>
              {isLast ? (
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
                  {item.label}
                </span>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight size={12} style={{ color: 'var(--color-text-muted)' }} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
