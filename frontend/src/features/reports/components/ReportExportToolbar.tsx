import React from 'react';
import { FileSpreadsheet, FileText, Download, RefreshCw, Printer } from 'lucide-react';
import { Button } from '../../../components/ui/Button/Button';
import './ReportExportToolbar.css';

export interface ReportExportToolbarProps {
  onRefresh?: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onExportCsv?: () => void;
  onPrintThermal?: () => void;
  isLoading?: boolean;
  isExportingExcel?: boolean;
  isExportingPdf?: boolean;
  isExportingCsv?: boolean;
  disabled?: boolean;
  className?: string;
}

export const ReportExportToolbar: React.FC<ReportExportToolbarProps> = ({
  onRefresh,
  onExportExcel,
  onExportPdf,
  onExportCsv,
  onPrintThermal,
  isLoading = false,
  isExportingExcel = false,
  isExportingPdf = false,
  isExportingCsv = false,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`report-export-toolbar ${className}`}>
      {onRefresh && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={disabled || isLoading}
          leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}
          title="Refresh Report Data"
        >
          Refresh
        </Button>
      )}

      {onExportExcel && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onExportExcel}
          disabled={disabled || isExportingExcel}
          leftIcon={<FileSpreadsheet size={15} color="#16a34a" />}
          title="Export to Excel (.xlsx)"
        >
          {isExportingExcel ? 'Exporting...' : 'Excel'}
        </Button>
      )}

      {onExportPdf && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onExportPdf}
          disabled={disabled || isExportingPdf}
          leftIcon={<FileText size={15} color="#dc2626" />}
          title="Download PDF (.pdf)"
        >
          {isExportingPdf ? 'Exporting...' : 'PDF'}
        </Button>
      )}

      {onExportCsv && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onExportCsv}
          disabled={disabled || isExportingCsv}
          leftIcon={<Download size={14} />}
          title="Download CSV"
        >
          {isExportingCsv ? 'Exporting...' : 'CSV'}
        </Button>
      )}

      {onPrintThermal && (
        <Button
          variant="primary"
          size="sm"
          onClick={onPrintThermal}
          disabled={disabled}
          leftIcon={<Printer size={15} />}
          title="Thermal Print Report (80mm / 58mm)"
        >
          Print Thermal
        </Button>
      )}
    </div>
  );
};
