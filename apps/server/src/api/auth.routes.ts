import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UNIT_SYSTEMS, type UserRow } from '@gym/shared';
import { prisma } from '../lib/prisma';
import { toWireRow } from '../services/sync/mapping';

const registerSchema = z.object({
  /** Optional client-generated id so data logged offline as a guest keeps its owner. */
  id: z.string().uuid().optional(),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(200),
  display_name: z.string().max(80).nullish(),
  unit_system: z.enum(UNIT_SYSTEMS).default('metric'),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

const toUser = (row: Record<string, unknown>) => toWireRow('users', row) as UserRow;

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return reply.code(409).send({ error: 'email_taken' });

    const user = await prisma.user.create({
      data: {
        id: body.id,
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 12),
        displayName: body.display_name ?? null,
        unitSystem: body.unit_system,
        syncVersion: 1,
        serverVersion: 1,
      },
    });
    const token = app.jwt.sign({ sub: user.id });
    return reply.code(201).send({ token, user: toUser(user) });
  });

  app.post('/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    return { token: app.jwt.sign({ sub: user.id }), user: toUser(user) };
  });

  app.get('/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) return reply.code(404).send({ error: 'not_found' });
    return { user: toUser(user) };
  });
};
