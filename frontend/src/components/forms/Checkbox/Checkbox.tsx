import React, { InputHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import './Checkbox.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={cn('checkbox-group', className)}>
        <label htmlFor={inputId} className="checkbox-label">
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            className="checkbox-input"
            {...props}
          />
          <span className="checkbox-custom" aria-hidden="true" />
          {label && <span className="checkbox-text">{label}</span>}
        </label>
        {error && <p className="form-error-msg">{error}</p>}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
