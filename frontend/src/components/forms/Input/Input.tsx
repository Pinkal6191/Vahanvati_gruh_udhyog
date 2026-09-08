import React, { InputHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import './Input.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isRequired?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      isRequired,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={cn('form-group', className)}>
        {label && (
          <label htmlFor={inputId} className="form-label">
            {label}
            {isRequired && <span className="form-required">*</span>}
          </label>
        )}
        <div className={cn('input-wrapper', error && 'input-error')}>
          {leftIcon && <span className="input-icon-left">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className="form-input"
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
          {rightIcon && <span className="input-icon-right">{rightIcon}</span>}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="form-error-msg">
            {error}
          </p>
        )}
        {!error && helperText && <p className="form-helper-msg">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
