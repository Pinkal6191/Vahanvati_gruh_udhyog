import React, { ReactNode } from 'react';
import { BadgeVariant } from '../../../types/common.types';
import { cn } from '../../../utils/cn';
import './Badge.css';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className,
  dot = false,
}) => {
  return (
    <span className={cn('badge', `badge-${variant}`, `badge-${size}`, className)}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
};
