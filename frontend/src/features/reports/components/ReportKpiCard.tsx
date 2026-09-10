import React from 'react';
import { Card } from '../../../components/ui/Card/Card';
import { Badge } from '../../../components/ui/Badge/Badge';
import { BadgeVariant } from '../../../types/common.types';
import './ReportKpiCard.css';

export interface ReportKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: {
    text: string;
    variant?: BadgeVariant;
  };
  icon?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

export const ReportKpiCard: React.FC<ReportKpiCardProps> = ({
  title,
  value,
  subtitle,
  badge,
  icon,
  isLoading = false,
  className = '',
}) => {
  if (isLoading) {
    return (
      <Card className={`report-kpi-card report-kpi-loading ${className}`}>
        <div className="report-kpi-skeleton-header" />
        <div className="report-kpi-skeleton-value" />
        <div className="report-kpi-skeleton-subtitle" />
      </Card>
    );
  }

  return (
    <Card className={`report-kpi-card ${className}`}>
      <div className="report-kpi-top">
        <span className="report-kpi-title">{title}</span>
        {icon && <div className="report-kpi-icon-wrapper">{icon}</div>}
      </div>

      <div className="report-kpi-value-row">
        <span className="report-kpi-value">{value}</span>
        {badge && (
          <Badge variant={badge.variant || 'brand'} size="sm">
            {badge.text}
          </Badge>
        )}
      </div>

      {subtitle && <p className="report-kpi-subtitle">{subtitle}</p>}
    </Card>
  );
};
