/**
 * Runs the API against an in-memory MongoDB and seeds demo data.
 * Nothing to install, nothing to configure — useful for demos and offline work.
 *
 *   pnpm --filter @acuheal/api dev:standalone
 *
 * Data lives only for the life of the process. Use a real MONGODB_URI (Atlas) for anything persistent.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

async function main() {
  const mongo = await MongoMemoryServer.create({ instance: { dbName: 'acuheal' } });
  const uri = mongo.getUri('acuheal');

  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET ??= 'dev-only-jwt-secret-change-in-production';
  process.env.JWT_REFRESH_SECRET ??= 'dev-only-refresh-secret-change-in-prod';
  // dev servers move ports when one is taken, so allow the usual local range
  process.env.CORS_ORIGIN ??= ['3000', '3001', '3002', '3010', '3007'].map((p) => `http://localhost:${p}`).join(',');
  process.env.STORAGE_DRIVER ??= 'local';
  process.env.WHATSAPP_PROVIDER ??= 'console';
  process.env.SEED_ADMIN_EMAIL ??= 'admin@acuheal.local';
  process.env.SEED_ADMIN_PASSWORD ??= 'Admin@12345';

  console.log(`In-memory MongoDB ready at ${uri}`);

  // seed first, then boot the API (both read the same env)
  const { connectDb, disconnectDb } = await import('../config/db.js');
  const { seedAll } = await import('../seed/seed.js');
  await connectDb();
  await seedAll({ demo: true });
  await disconnectDb();

  await import('../index.js');

  const shutdown = async () => {
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
