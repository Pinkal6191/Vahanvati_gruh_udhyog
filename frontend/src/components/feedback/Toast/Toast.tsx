import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { ToastMessage } from '../../../types/common.types';
import { cn } from '../../../utils/cn';
import './Toast.css';

export interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" role="region" aria-label="Notifications">
      {toasts.map((toast) => {
        const getIcon = () => {
          switch (toast.type) {
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
          <div key={toast.id} className={cn('toast-item', `toast-${toast.type}`)}>
            <span className="toast-icon">{getIcon()}</span>
            <div className="toast-content">
              {toast.title && <div className="toast-title">{toast.title}</div>}
              <div className="toast-message">{toast.message}</div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="toast-close-btn"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
