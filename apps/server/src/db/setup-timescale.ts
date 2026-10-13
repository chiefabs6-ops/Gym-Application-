/**
 * Idempotent TimescaleDB setup, run after every `prisma migrate`.
 * Prisma doesn't model hypertables, so this lives outside the migration history.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS timescaledb`);
  await prisma.$executeRawUnsafe(
    `SELECT create_hypertable('telemetry_points', 'recorded_at',
       chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE, migrate_data => TRUE)`,
  );
  console.log('TimescaleDB: telemetry_points hypertable ready');
} finally {
  await prisma.$disconnect();
}
