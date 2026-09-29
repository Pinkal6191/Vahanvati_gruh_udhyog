import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '../../../components/ui/Button/Button';
import './ReportEmptyState.css';

export interface ReportEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  minHeight?: number | string;
  className?: string;
}

export const ReportEmptyState: React.FC<ReportEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  minHeight = 220,
  className = '',
}) => {
  return (
    <div
      className={`report-empty-state-card ${className}`}
      style={{ minHeight }}
      role="status"
      aria-label={title}
    >
      <div className="report-empty-state-icon-box">
        {icon || <Inbox size={22} className="report-empty-state-default-icon" />}
      </div>
      <h4 className="report-empty-state-title">{title}</h4>
      <p className="report-empty-state-desc">{description}</p>
      {action && (
        <div className="report-empty-state-action">
          <Button
            size="sm"
            variant="outline"
            onClick={action.onClick}
            leftIcon={action.icon}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
};
