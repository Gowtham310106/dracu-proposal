import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import { startCron } from './jobs/index.js';
import { storage } from './integrations/storage/index.js';
import { whatsapp } from './integrations/whatsapp/index.js';

async function main() {
  await connectDb();
  storage();
  whatsapp();
  const app = createApp();
  const server = app.listen(env.PORT, () => logger.info(`API listening on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`));
  startCron();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(() => void disconnectDb().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'fatal startup error');
  process.exit(1);
});
