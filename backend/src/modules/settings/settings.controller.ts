import { Request, Response, NextFunction } from 'express';
import { SettingsService } from './settings.service.js';

export class SettingsController {
  static async getSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await SettingsService.getCompanySettings();
      res.status(200).json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await SettingsService.updateCompanySettings(req.body);
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
}
