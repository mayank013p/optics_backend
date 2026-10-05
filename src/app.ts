import express, { Application } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import config from './config';
import apiRouter from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { notFoundHandler } from './middlewares/notFound.middleware';

export const createApp = (): Application => {
  const app = express();

  // Permissive Universal CORS Configuration
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow all origins (browsers, postman, mobile, SSR)
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-org-id',
      'Accept',
      'Origin',
      'X-Requested-With',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
    ],
    exposedHeaders: ['Authorization', 'Content-Disposition'],
    optionsSuccessStatus: 200,
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // Body parsers
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  if (config.env !== 'test') {
    app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));
  }

  // Static uploads for local file storage driver
  const uploadDir = path.resolve(config.storage.localPath);
  app.use('/uploads', express.static(uploadDir));

  // Mount API master router
  app.use('/api', apiRouter);

  // 404 handler for undefined endpoints
  app.use(notFoundHandler);

  // Global Centralized Error Handler
  app.use(errorHandler);

  return app;
};

export const app = createApp();
export default app;
