import React, { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../../utils/cn';
import '../Input/Input.css';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  helperText?: string;
  error?: string;
  isRequired?: boolean;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      options,
      helperText,
      error,
      isRequired,
      placeholder,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={cn('form-group', className)}>
        {label && (
          <label htmlFor={selectId} className="form-label">
            {label}
            {isRequired && <span className="form-required">*</span>}
          </label>
        )}
        <div className={cn('input-wrapper', error && 'input-error')}>
          <select
            ref={ref}
            id={selectId}
            className="form-input"
            aria-invalid={!!error}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="form-error-msg">{error}</p>}
        {!error && helperText && <p className="form-helper-msg">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
