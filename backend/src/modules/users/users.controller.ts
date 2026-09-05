import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service.js';

export class UsersController {
  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const users = await UsersService.list();
      res.status(200).json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UsersService.create(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UsersService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
}
