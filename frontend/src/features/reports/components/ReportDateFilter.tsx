import React, { useState } from 'react';
import { Calendar, Filter, RotateCcw } from 'lucide-react';
import { ReportDatePeriod } from '../reports.api';
import { Button } from '../../../components/ui/Button/Button';
import './ReportDateFilter.css';

export interface ReportDateFilterProps {
  period?: ReportDatePeriod;
  startDate?: string;
  endDate?: string;
  onFilterChange: (filters: {
    period?: ReportDatePeriod;
    startDate?: string;
    endDate?: string;
  }) => void;
  isLoading?: boolean;
  className?: string;
}

export const ReportDateFilter: React.FC<ReportDateFilterProps> = ({
  period = 'this_month',
  startDate = '',
  endDate = '',
  onFilterChange,
  isLoading = false,
  className = '',
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<ReportDatePeriod>(period);
  const [customStart, setCustomStart] = useState<string>(startDate);
  const [customEnd, setCustomEnd] = useState<string>(endDate);

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as ReportDatePeriod;
    setSelectedPeriod(val);
    if (val !== 'custom') {
      onFilterChange({ period: val });
    }
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPeriod === 'custom') {
      onFilterChange({
        period: 'custom',
        startDate: customStart || undefined,
        endDate: customEnd || undefined,
      });
    } else {
      onFilterChange({ period: selectedPeriod });
    }
  };

  const handleReset = () => {
    setSelectedPeriod('this_month');
    setCustomStart('');
    setCustomEnd('');
    onFilterChange({ period: 'this_month' });
  };

  return (
    <div className={`report-date-filter-bar ${className}`}>
      <div className="report-date-filter-group">
        <div className="report-filter-select-wrapper">
          <Calendar size={16} className="report-filter-icon" />
          <select
            aria-label="Select report date period"
            value={selectedPeriod}
            onChange={handlePeriodChange}
            className="report-filter-select"
            disabled={isLoading}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="this_year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {selectedPeriod === 'custom' && (
          <div className="report-custom-dates">
            <input
              type="date"
              aria-label="Start date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="report-date-input"
              disabled={isLoading}
            />
            <span className="report-date-separator">to</span>
            <input
              type="date"
              aria-label="End date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="report-date-input"
              disabled={isLoading}
            />
          </div>
        )}

        {selectedPeriod === 'custom' && (
          <Button
            size="sm"
            variant="primary"
            onClick={handleApplyCustom}
            isLoading={isLoading}
            leftIcon={<Filter size={14} />}
          >
            Apply
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={handleReset}
          disabled={isLoading}
          title="Reset to This Month"
          leftIcon={<RotateCcw size={14} />}
        >
          Reset
        </Button>
      </div>
    </div>
  );
};
