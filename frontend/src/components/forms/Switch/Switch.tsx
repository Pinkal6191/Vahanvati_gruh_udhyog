import React, { InputHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import './Switch.css';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, className, id, checked, ...props }, ref) => {
    const switchId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <label htmlFor={switchId} className={cn('switch-container', className)}>
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
    );
  }
);

Switch.displayName = 'Switch';
