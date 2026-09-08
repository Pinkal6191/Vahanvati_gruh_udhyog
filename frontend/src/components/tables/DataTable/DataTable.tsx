import React, { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { Pagination } from '../Pagination/Pagination';
import './DataTable.css';

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  cell?: (row: T, index: number) => ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
  // Optional pagination
  page?: number;
  totalPages?: number;
  total?: number;
  limit?: number;
  onPageChange?: (newPage: number) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'No records found',
  onRowClick,
  className,
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: DataTableProps<T>) {
  return (
    <div className={cn('table-card', className)}>
      <div className="table-scroll-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width, textAlign: col.align || 'left' }}
                  className="table-header-cell"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Loading Skeleton rows
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="table-skeleton-row">
                  {columns.map((col) => (
                    <td key={`col-${col.key}`} className="table-cell">
                      <div className="table-skeleton-bar" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-empty-cell">
                  <div className="table-empty-container">
                    <p className="table-empty-text">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={keyExtractor(row, idx)}
                  onClick={() => onRowClick?.(row)}
                  className={cn('table-row', onRowClick && 'table-row-clickable')}
                >
                  {columns.map((col) => {
                    const value = col.cell ? col.cell(row, idx) : (row as any)[col.key];
                    return (
                      <td
                        key={col.key}
                        style={{ textAlign: col.align || 'left' }}
                        className="table-cell"
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {page && totalPages && total !== undefined && limit && onPageChange && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
