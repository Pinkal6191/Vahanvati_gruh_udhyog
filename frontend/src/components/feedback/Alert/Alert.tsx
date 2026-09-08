import React, { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../../utils/cn';
import './Alert.css';

export interface AlertProps {
  type?: 'success' | 'warning' | 'error' | 'danger' | 'info';
  variant?: 'success' | 'warning' | 'error' | 'danger' | 'info';
  title?: string;
  message?: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type,
  variant,
  title,
  message,
  children,
  onClose,
  className,
}) => {
  const alertType = (variant || type || 'info').replace('danger', 'error') as 'success' | 'warning' | 'error' | 'info';

  const getIcon = () => {
    switch (alertType) {
      case 'success':
        return <CheckCircle2 size={18} />;
      case 'warning':
        return <AlertTriangle size={18} />;
      case 'error':
        return <AlertCircle size={18} />;
      case 'info':
      default:
        return <Info size={18} />;
    }
  };

  return (
    <div className={cn('alert', `alert-${alertType}`, className)} role="alert">
      <span className="alert-icon">{getIcon()}</span>
      <div className="alert-content">
        {title && <h4 className="alert-title">{title}</h4>}
        <div className="alert-message">{message || children}</div>
      </div>
      {onClose && (
        <button onClick={onClose} className="alert-close-btn" aria-label="Close alert">
          <X size={16} />
        </button>
      )}
    </div>
  );
};
