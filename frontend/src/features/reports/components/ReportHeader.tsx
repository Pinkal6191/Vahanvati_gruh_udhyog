import React, { ReactNode } from 'react';
import { Breadcrumb, BreadcrumbItem } from '../../../components/common/Breadcrumb/Breadcrumb';
import './ReportHeader.css';

export interface ReportHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  breadcrumbs,
  title,
  subtitle,
  actions,
  className = '',
}) => {
  return (
    <div className={`report-header-root ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="report-header-breadcrumbs">
          <Breadcrumb items={breadcrumbs} />
        </div>
      )}
      <div className="report-header-main">
        <div className="report-header-content">
          <h1 className="report-header-title">{title}</h1>
          {subtitle && <p className="report-header-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="report-header-actions-area">{actions}</div>}
      </div>
    </div>
  );
};
