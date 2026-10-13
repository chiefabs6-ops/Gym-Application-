import { buildApp } from './app';
import { env } from './lib/env';
import { prisma } from './lib/prisma';
import { createRedis } from './lib/redis';

const redis = createRedis();
const app = await buildApp(redis);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await Promise.all([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: env.HOST, port: env.PORT });
