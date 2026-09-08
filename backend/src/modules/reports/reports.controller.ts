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

export class ReportsController {
  /**
   * GET /api/v1/reports/sales
   */
  static async getSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getSalesReport(req.query as unknown as SalesReportQuery);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/sales/products
   */
  static async getProductSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getProductSalesReport(
        req.query as unknown as ProductReportQuery
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/sales/customers
   */
  static async getCustomerSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getCustomerSalesReport(
        req.query as unknown as CustomerReportQuery
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/customers/:customerId
   */
  static async getCustomerPurchaseHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getCustomerPurchaseHistory(
        req.params.customerId,
        req.query as unknown as CustomerHistoryQuery
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/production
   */
  static async getProductionReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getProductionReport(
        req.query as unknown as ProductionReportQuery
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/stock
   */
  static async getStockReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getStockReport(req.query as unknown as StockReportQuery);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/stock/movements
   */
  static async getStockMovementsReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getStockMovementsReport(
        req.query as unknown as StockMovementsReportQuery
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/stock/reconciliation
   */
  static async getStockReconciliationReport(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getStockReconciliationReport();
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/returns
   */
  static async getReturnsReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getReturnsReport(
        req.query as unknown as ReturnsReportQuery
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/business-summary
   */
  static async getBusinessSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.getBusinessSummary(
        req.query as unknown as BusinessSummaryQuery
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
