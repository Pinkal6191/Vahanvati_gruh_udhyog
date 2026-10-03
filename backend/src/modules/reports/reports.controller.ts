import { Request, Response, NextFunction } from 'express';
import { ReportsService } from './reports.service.js';
import {
  SalesReportQuery,
  ProductReportQuery,
  CustomerReportQuery,
  CustomerHistoryQuery,
  ProductionReportQuery,
  StockReportQuery,
  StockMovementsReportQuery,
  ReturnsReportQuery,
  BusinessSummaryQuery,
} from './reports.validation.js';
import {
  exportSalesReportToExcel,
  exportProductSalesReportToExcel,
  exportCustomerSalesReportToExcel,
  exportCustomerHistoryToExcel,
  exportProductionReportToExcel,
  exportStockReportToExcel,
  exportStockMovementsToExcel,
  exportStockReconciliationToExcel,
  exportReturnsReportToExcel,
  exportBusinessSummaryToExcel,
  exportStatutorySalesToExcel,
  exportStatutoryItemizedToExcel,
  exportStatutoryReturnsToExcel,
  exportStatutoryGstSummaryToExcel,
  exportCashSalesToExcel,
} from './reports.excel.js';
import {
  exportSalesReportToPdf,
  exportProductSalesReportToPdf,
  exportCustomerSalesReportToPdf,
  exportCustomerHistoryToPdf,
  exportProductionReportToPdf,
  exportStockReportToPdf,
  exportStockMovementsToPdf,
  exportStockReconciliationToPdf,
  exportReturnsReportToPdf,
  exportBusinessSummaryToPdf,
  exportStatutorySalesToPdf,
  exportStatutoryItemizedToPdf,
  exportStatutoryReturnsToPdf,
  exportStatutoryGstSummaryToPdf,
  exportCashSalesToPdf,
} from './reports.pdf.js';

export class ReportsController {
  private static sendXlsx(res: Response, buffer: Buffer, filename: string) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  }

  private static sendPdf(res: Response, buffer: Buffer, filename: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  }

  /**
   * 1. GET /api/v1/reports/sales
   */
  static async getSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getSalesReport(
        req.query as unknown as SalesReportQuery,
        req.user
      );
      const format = (req.query as any).format;
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'xlsx') {
        const buf = await exportSalesReportToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `sales-report-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportSalesReportToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `sales-report-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 2. GET /api/v1/reports/sales/products
   */
  static async getProductSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const format = (req.query as any).format;
      const isExport = format === 'xlsx' || format === 'pdf';
      const query: any = { ...req.query };
      if (isExport) {
        query.limit = 10000;
        query.page = 1;
      }
      const result = await ReportsService.getProductSalesReport(
        query as unknown as ProductReportQuery,
        req.user
      );
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'xlsx') {
        const buf = await exportProductSalesReportToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `product-sales-report-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportProductSalesReportToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `product-sales-report-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 3. GET /api/v1/reports/sales/customers
   */
  static async getCustomerSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const format = (req.query as any).format;
      const isExport = format === 'xlsx' || format === 'pdf';
      const query: any = { ...req.query };
      if (isExport) {
        query.limit = 10000;
        query.page = 1;
      }
      const result = await ReportsService.getCustomerSalesReport(
        query as unknown as CustomerReportQuery,
        req.user
      );
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'xlsx') {
        const buf = await exportCustomerSalesReportToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `customer-sales-report-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportCustomerSalesReportToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `customer-sales-report-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 4. GET /api/v1/reports/customers/:customerId
   */
  static async getCustomerPurchaseHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getCustomerPurchaseHistory(
        req.params.customerId,
        req.query as unknown as CustomerHistoryQuery,
        req.user
      );
      const format = (req.query as any).format;
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'xlsx') {
        const buf = await exportCustomerHistoryToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `customer-history-${req.params.customerId}-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportCustomerHistoryToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `customer-history-${req.params.customerId}-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 5. GET /api/v1/reports/production
   */
  static async getProductionReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getProductionReport(
        req.query as unknown as ProductionReportQuery
      );
      const format = (req.query as any).format;
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'xlsx') {
        const buf = await exportProductionReportToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `production-report-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportProductionReportToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `production-report-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 6. GET /api/v1/reports/stock
   */
  static async getStockReport(req: Request, res: Response, next: NextFunction) {
    try {
      const format = (req.query as any).format;
      const isExport = format === 'xlsx' || format === 'pdf';
      const query: any = { ...req.query };
      if (isExport) {
        query.limit = 10000;
        query.page = 1;
      }
      const result = await ReportsService.getStockReport(query as unknown as StockReportQuery);
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'xlsx') {
        const buf = await exportStockReportToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `stock-report-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportStockReportToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `stock-report-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 7. GET /api/v1/reports/stock/movements
   */
  static async getStockMovementsReport(req: Request, res: Response, next: NextFunction) {
    try {
      const format = (req.query as any).format;
      const isExport = format === 'xlsx' || format === 'pdf';
      const query: any = { ...req.query };
      if (isExport) {
        query.limit = 10000;
        query.page = 1;
      }
      const result = await ReportsService.getStockMovementsReport(
        query as unknown as StockMovementsReportQuery
      );
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'xlsx') {
        const buf = await exportStockMovementsToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `stock-movements-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportStockMovementsToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `stock-movements-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 8. GET /api/v1/reports/stock/reconciliation
   */
  static async getStockReconciliationReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getStockReconciliationReport();
      const format = (req.query as any).format;
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'xlsx') {
        const buf = await exportStockReconciliationToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `stock-reconciliation-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportStockReconciliationToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `stock-reconciliation-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 9. GET /api/v1/reports/returns
   */
  static async getReturnsReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getReturnsReport(
        req.query as unknown as ReturnsReportQuery,
        req.user
      );
      const format = (req.query as any).format;
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'xlsx') {
        const buf = await exportReturnsReportToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `sales-returns-report-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportReturnsReportToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `sales-returns-report-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 10. GET /api/v1/reports/business-summary
   */
  static async getBusinessSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getBusinessSummary(
        req.query as unknown as BusinessSummaryQuery,
        req.user
      );
      const format = (req.query as any).format;
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'xlsx') {
        const buf = await exportBusinessSummaryToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `business-summary-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportBusinessSummaryToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `business-summary-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // Phase 2F: Statutory / CA Compliance Handlers
  // ==========================================

  /**
   * 11. GET /api/v1/reports/statutory/sales
   */
  static async getStatutorySales(req: Request, res: Response, next: NextFunction) {
    try {
      const format = (req.query as any).format;
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'csv') {
        const csvString = await ReportsService.getStatutorySalesRegister(req.query as any, req.user);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="statutory-sales-register-${dateStr}.csv"`);
        return res.status(200).send(csvString);
      }

      const result = await ReportsService.getStatutorySalesRegister(
        { ...(req.query as any), format: 'json' },
        req.user
      );

      if (format === 'xlsx') {
        const buf = await exportStatutorySalesToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `statutory-sales-register-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportStatutorySalesToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `statutory-sales-register-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, ...(result as object) });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 12. GET /api/v1/reports/statutory/sales/itemized
   */
  static async getStatutoryItemizedSales(req: Request, res: Response, next: NextFunction) {
    try {
      const format = (req.query as any).format;
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'csv') {
        const csvString = await ReportsService.getStatutoryItemizedSalesRegister(req.query as any, req.user);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="statutory-itemized-sales-${dateStr}.csv"`);
        return res.status(200).send(csvString);
      }

      const result = await ReportsService.getStatutoryItemizedSalesRegister(
        { ...(req.query as any), format: 'json' },
        req.user
      );

      if (format === 'xlsx') {
        const buf = await exportStatutoryItemizedToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `statutory-itemized-sales-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportStatutoryItemizedToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `statutory-itemized-sales-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, ...(result as object) });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 13. GET /api/v1/reports/statutory/returns
   */
  static async getStatutoryReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const format = (req.query as any).format;
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'csv') {
        const csvString = await ReportsService.getStatutoryReturnsRegister(req.query as any, req.user);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="statutory-sales-returns-${dateStr}.csv"`);
        return res.status(200).send(csvString);
      }

      const result = await ReportsService.getStatutoryReturnsRegister(
        { ...(req.query as any), format: 'json' },
        req.user
      );

      if (format === 'xlsx') {
        const buf = await exportStatutoryReturnsToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `statutory-sales-returns-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportStatutoryReturnsToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `statutory-sales-returns-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, ...(result as object) });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 14. GET /api/v1/reports/statutory/gst-summary
   */
  static async getStatutoryGstSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const format = (req.query as any).format;
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'csv') {
        const csvString = await ReportsService.getStatutoryGstSummary(req.query as any, req.user);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="statutory-gst-summary-${dateStr}.csv"`);
        return res.status(200).send(csvString);
      }

      const result = await ReportsService.getStatutoryGstSummary(
        { ...(req.query as any), format: 'json' },
        req.user
      );

      if (format === 'xlsx') {
        const buf = await exportStatutoryGstSummaryToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `statutory-gst-summary-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportStatutoryGstSummaryToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `statutory-gst-summary-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, ...(result as object) });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 15. GET /api/v1/reports/cash-sales (ADMIN ONLY)
   */
  static async getCashSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const format = (req.query as any).format;
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'csv') {
        const csvString = await ReportsService.getCashSalesReport(req.query as any, req.user);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="cash-sales-report-${dateStr}.csv"`);
        return res.status(200).send(csvString);
      }

      const result = await ReportsService.getCashSalesReport(
        { ...(req.query as any), format: 'json' },
        req.user
      );

      if (format === 'xlsx') {
        const buf = await exportCashSalesToExcel(result, req.query);
        return ReportsController.sendXlsx(res, buf, `cash-sales-report-${dateStr}.xlsx`);
      }
      if (format === 'pdf') {
        const buf = await exportCashSalesToPdf(result, req.query);
        return ReportsController.sendPdf(res, buf, `cash-sales-report-${dateStr}.pdf`);
      }

      res.status(200).json({ success: true, ...(result as object) });
    } catch (err) {
      next(err);
    }
  }
}
