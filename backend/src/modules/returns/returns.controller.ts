import { Request, Response, NextFunction } from 'express';
import { ReturnsService } from './returns.service.js';

export class ReturnsController {
  static async createReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.createReturn(req.user!.id, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.getById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async listReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnsService.listReturns(req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
