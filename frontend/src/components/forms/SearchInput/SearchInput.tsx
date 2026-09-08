import React, { InputHTMLAttributes, forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../../utils/cn';
import '../Input/Input.css';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onClear, className, placeholder = 'Search...', ...props }, ref) => {
    return (
      <div className={cn('input-wrapper', className)}>
        <span className="input-icon-left">
          <Search size={16} />
        </span>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="form-input"
          {...props}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="input-icon-right"
            style={{ cursor: 'pointer', background: 'none', border: 'none' }}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
