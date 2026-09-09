import React, { InputHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import './Switch.css';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, description, className, id, checked, ...props }, ref) => {
    const switchId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={cn('switch-wrapper', className)}>
        <label htmlFor={switchId} className="switch-container">
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            checked={checked}
            className="switch-input"
            {...props}
          />
          <span className="switch-track" aria-hidden="true">
            <span className="switch-thumb" />
          </span>
          {label && <span className="switch-label">{label}</span>}
        </label>
        {description && (
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)', marginLeft: '48px', marginTop: '2px' }}>
            {description}
          </p>
        )}
      </div>
    );
  }
);

Switch.displayName = 'Switch';
