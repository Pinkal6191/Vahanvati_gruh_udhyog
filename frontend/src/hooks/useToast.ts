import { useContext } from 'react';
import { ToastContext, ToastContextType } from '../app/providers/ToastProvider';

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
