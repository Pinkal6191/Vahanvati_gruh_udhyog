import React, { useState } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import './ReportCharts.css';

// 1. Time Series Bar Chart (Pure SVG)
export interface TimeSeriesBarItem {
  label: string; // e.g. "2026-09-01" or "Mon"
  value: number; // primary metric e.g. salesAmount
  secondaryValue?: number; // e.g. billsCount
  tooltip?: string;
}

export interface TimeSeriesBarChartProps {
  data: TimeSeriesBarItem[];
  title?: string;
  height?: number;
  formatVal?: (v: number) => string;
  emptyMessage?: string;
}

export const TimeSeriesBarChart: React.FC<TimeSeriesBarChartProps> = ({
  data,
  title,
  height = 220,
  formatVal = formatCurrency,
  emptyMessage = 'No trend data available for selected period',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="report-chart-empty" style={{ height }}>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const chartHeight = height - 40; // reserve space for x-axis labels
  const barWidthPercent = Math.min(100 / (data.length * 1.5), 12);

  return (
    <div className="report-bar-chart-container">
      {title && <h4 className="report-chart-title">{title}</h4>}

      <div className="report-bar-chart-body" style={{ height }}>
        {/* Y-axis guide lines */}
        <div className="report-chart-grid">
          <div className="report-chart-grid-line">
            <span>{formatVal(maxValue)}</span>
          </div>
          <div className="report-chart-grid-line">
            <span>{formatVal(maxValue / 2)}</span>
          </div>
          <div className="report-chart-grid-line">
            <span>0</span>
          </div>
        </div>

        {/* Bars Container */}
        <div className="report-bars-row">
          {data.map((item, idx) => {
            const barHeightPercent = Math.max((item.value / maxValue) * 100, 2);
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={idx}
                className="report-bar-column"
                style={{ width: `${barWidthPercent}%` }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="report-bar-tooltip">
                    <strong>{item.label}</strong>
                    <div>{formatVal(item.value)}</div>
                    {item.secondaryValue !== undefined && (
                      <div className="report-bar-subtext">
                        {item.secondaryValue} bills
                      </div>
                    )}
                  </div>
                )}

                {/* The Bar */}
                <div className="report-bar-track">
                  <div
                    className={`report-bar-fill ${isHovered ? 'report-bar-hovered' : ''}`}
                    style={{ height: `${barHeightPercent}%` }}
                  />
                </div>

                {/* X-axis Label */}
                <span className="report-bar-label" title={item.label}>
                  {item.label.length > 10 ? item.label.slice(-5) : item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 2. Multi-Segment Payment Breakdown Distribution Bar
export interface PaymentBreakdownBarProps {
  breakdown: Record<string, number>;
  title?: string;
  formatVal?: (v: number) => string;
}

const PAYMENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  CASH: { bg: '#10b981', text: '#065f46', label: 'Cash' },
  UPI: { bg: '#6366f1', text: '#3730a3', label: 'UPI' },
  CARD: { bg: '#f59e0b', text: '#92400e', label: 'Card' },
  OTHER: { bg: '#8b5cf6', text: '#5b21b6', label: 'Other' },
  STORE_CREDIT: { bg: '#ec4899', text: '#9d174d', label: 'Store Credit' },
  CREDIT_NOTE: { bg: '#ec4899', text: '#9d174d', label: 'Credit Note' },
};

export const PaymentBreakdownBar: React.FC<PaymentBreakdownBarProps> = ({
  breakdown,
  title = 'Payment Mode Distribution',
  formatVal = formatCurrency,
}) => {
  const entries = Object.entries(breakdown || {}).filter(([_, amount]) => amount > 0);
  const total = entries.reduce((acc, [_, amt]) => acc + amt, 0);

  if (total === 0) {
    return (
      <div className="report-payment-card">
        {title && <h4 className="report-chart-title">{title}</h4>}
        <p className="report-chart-empty-text">No payment records in selected period</p>
      </div>
    );
  }

  return (
    <div className="report-payment-card">
      {title && <h4 className="report-chart-title">{title}</h4>}

      {/* Segmented Bar */}
      <div className="report-segmented-bar" role="progressbar" aria-valuenow={100}>
        {entries.map(([mode, amt]) => {
          const percent = ((amt / total) * 100).toFixed(1);
          const config = PAYMENT_COLORS[mode] || {
            bg: '#64748b',
            text: '#1e293b',
            label: mode,
          };

          return (
            <div
              key={mode}
              className="report-segment-slice"
              style={{
                width: `${percent}%`,
                backgroundColor: config.bg,
              }}
              title={`${config.label}: ${formatVal(amt)} (${percent}%)`}
            />
          );
        })}
      </div>

      {/* Legend & Amounts */}
      <div className="report-payment-legend">
        {entries.map(([mode, amt]) => {
          const percent = ((amt / total) * 100).toFixed(1);
          const config = PAYMENT_COLORS[mode] || {
            bg: '#64748b',
            text: '#1e293b',
            label: mode,
          };

          return (
            <div key={mode} className="report-legend-item">
              <span className="report-legend-dot" style={{ backgroundColor: config.bg }} />
              <span className="report-legend-label">{config.label}</span>
              <span className="report-legend-val">{formatVal(amt)}</span>
              <span className="report-legend-pct">({percent}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
