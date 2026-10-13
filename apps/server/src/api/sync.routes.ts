import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pushRequestSchema } from '@gym/shared';
import { pushMutations } from '../services/sync/push';
import { pullChanges } from '../services/sync/pull';
import { enqueuePushEffects } from '../services/queue/enqueue';
import type { Queues } from '../services/queue/queues';

const pullQuerySchema = z.object({ cursor: z.coerce.number().int().min(0).default(0) });

export const syncRoutes: FastifyPluginAsync<{ queues: Queues }> = async (app, { queues }) => {
  app.addHook('onRequest', app.authenticate);

  app.post('/push', { bodyLimit: 5 * 1024 * 1024 }, async (req) => {
    const { mutations } = pushRequestSchema.parse(req.body);
    const userId = req.user.sub;
    const { response, effects } = await pushMutations(userId, mutations);
    void enqueuePushEffects(queues, userId, response.server_version, effects, req.log);
    return response;
  });

  app.get('/pull', async (req) => {
    const { cursor } = pullQuerySchema.parse(req.query);
    return pullChanges(req.user.sub, cursor);
  });
};
