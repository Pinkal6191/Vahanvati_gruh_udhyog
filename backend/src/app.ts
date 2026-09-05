import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './docs/openapi.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { NotFoundError } from './common/errors/app-error.js';

// Module Routes
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import customersRoutes from './modules/customers/customers.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import pricingRoutes from './modules/pricing/pricing.routes.js';
import salesRoutes from './modules/sales/sales.routes.js';
import returnsRoutes from './modules/returns/returns.routes.js';
import productionRoutes from './modules/production/production.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';

export function createApp(): Express {
  const app = express();

  // Security & standard middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging
  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      })
    );
  }

  // System Health Check
  app.get(['/health', `${env.API_PREFIX}/health`], async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Vahanvati Gruh Udhyog Backend',
        environment: env.NODE_ENV,
        database: 'connected',
      });
    } catch (error) {
      next(error);
    }
  });

  // Swagger API Documentation
  app.use(`${env.API_PREFIX}/docs`, swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get(`${env.API_PREFIX}/docs.json`, (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  // Base API info
  app.get(env.API_PREFIX, (_req: Request, res: Response) => {
    res.status(200).json({
      message: 'Vahanvati Gruh Udhyog API v1',
      version: '1.0.0',
      documentation: `http://localhost:${env.PORT}${env.API_PREFIX}/docs`,
      modules: [
        'auth',
        'users',
        'customers',
        'catalog',
        'pricing',
        'sales',
        'returns',
        'production',
        'inventory',
        'settings',
      ],
    });
  });

  // Mount Domain Modules
  app.use(`${env.API_PREFIX}/auth`, authRoutes);
  app.use(`${env.API_PREFIX}/users`, usersRoutes);
  app.use(`${env.API_PREFIX}/customers`, customersRoutes);
  app.use(`${env.API_PREFIX}/catalog`, productsRoutes);
  app.use(`${env.API_PREFIX}/pricing`, pricingRoutes);
  app.use(`${env.API_PREFIX}/sales`, salesRoutes);
  app.use(`${env.API_PREFIX}/returns`, returnsRoutes);
  app.use(`${env.API_PREFIX}/production`, productionRoutes);
  app.use(`${env.API_PREFIX}/inventory`, inventoryRoutes);
  app.use(`${env.API_PREFIX}/settings`, settingsRoutes);

  // 404 Handler
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
