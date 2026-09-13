import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import mongoose from 'mongoose';
import { corsOrigins, env } from './config/env.js';
import { logger } from './config/logger.js';
import { requireAuth } from './middleware/auth.js';
import { branchScope } from './middleware/branchScope.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { uploadRoot } from './integrations/storage/index.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { branchesRouter } from './modules/branches/branches.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { patientsRouter } from './modules/patients/patients.routes.js';
import { appointmentsRouter } from './modules/appointments/appointments.routes.js';
import { packagesRouter } from './modules/packages/packages.routes.js';
import { billingRouter } from './modules/billing/billing.routes.js';
import { leadsRouter } from './modules/leads/leads.routes.js';
import { accountsRouter } from './modules/accounts/accounts.routes.js';
import { attendanceRouter, biometricRouter } from './modules/attendance/attendance.routes.js';
import { localUploadRouter, mediaRouter } from './modules/media/media.routes.js';
import { messagingRouter } from './modules/messaging/messaging.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { jobsRouter } from './jobs/jobs.routes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || corsOrigins.includes(origin) || corsOrigins.includes('*')) return cb(null, true);
        if (/\.vercel\.app$/.test(new URL(origin).hostname) && corsOrigins.some((o) => o.includes('vercel.app'))) return cb(null, true);
        return cb(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(cookieParser());
  if (env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/v1/health' }, customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'silent') }));
  }

  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', time: new Date().toISOString(), storage: env.STORAGE_DRIVER, whatsapp: env.WHATSAPP_PROVIDER } });
  });

  // machine / public routes (no user session)
  api.use('/media', localUploadRouter); // raw body PUT, must be before express.json
  api.use('/integrations/biometric', express.json({ limit: '2mb' }), biometricRouter);
  api.use('/jobs', express.json(), jobsRouter);

  api.use(express.json({ limit: '1mb' }));
  api.use('/auth', authRouter);

  // everything below requires a signed-in user and a resolved branch scope
  api.use(requireAuth, branchScope);
  api.use('/branches', branchesRouter);
  api.use('/users', usersRouter);
  api.use('/patients', patientsRouter);
  api.use('/appointments', appointmentsRouter);
  api.use('/packages', packagesRouter);
  api.use('/billing', billingRouter);
  api.use('/leads', leadsRouter);
  api.use('/accounts', accountsRouter);
  api.use('/attendance', attendanceRouter);
  api.use('/media', mediaRouter);
  api.use('/messaging', messagingRouter);
  api.use('/reports', reportsRouter);
  api.use('/audit', auditRouter);

  app.use('/api/v1', api);
  if (env.STORAGE_DRIVER === 'local') app.use('/uploads', express.static(uploadRoot, { maxAge: '7d' }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
