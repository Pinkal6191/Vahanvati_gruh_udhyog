import React, { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import './PageHeader.css';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  breadcrumbs,
  className,
}) => {
  return (
    <div className={cn('page-header', className)}>
      {breadcrumbs && <div className="page-header-breadcrumbs">{breadcrumbs}</div>}
      <div className="page-header-row">
        <div className="page-header-headings">
          <h1 className="page-header-title">{title}</h1>
          {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </div>
  );
};
