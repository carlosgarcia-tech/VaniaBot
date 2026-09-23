import { Router } from 'express';
import type { Request, Response } from 'express';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { requireApiToken } from './auth.js';

export function createModerationRouter(webhookToken: string): Router {
  const router = Router();

  // All moderation data is sensitive (user JIDs, reasons, moderator names).
  // The dashboard must send the token in the `x-api-token` header.
  router.use(requireApiToken(webhookToken));

  router.get('/bans', async (_req: Request, res: Response) => {
    try {
      const db = serviceManager.db;
      if (!db) {
        res.status(501).json({ error: 'Database not available' });
        return;
      }
      const allBans = await db.getAll<{
        userId: string;
        userName: string;
        reason: string;
        timestamp: number;
      }>('bans');
      res.json({ total: allBans.length, bans: allBans.slice(0, 100) });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.get('/mutes', async (_req: Request, res: Response) => {
    try {
      const db = serviceManager.db;
      if (!db) {
        res.status(501).json({ error: 'Database not available' });
        return;
      }
      const allMutes = await db.getAll<{ expiresAt: number; userId: string; userName: string }>(
        'mutes',
      );
      const activeMutes = allMutes.filter(m => m.expiresAt > Date.now());
      res.json({
        total: allMutes.length,
        active: activeMutes.length,
        mutes: activeMutes.slice(0, 100),
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.get('/actions', async (req: Request, res: Response) => {
    try {
      const db = serviceManager.db;
      if (!db) {
        res.status(501).json({ error: 'Database not available' });
        return;
      }
      const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 100);
      const result = await db.getPaginated('moderation_logs', {
        page: 1,
        limit,
        sortBy: 'timestamp',
        sortOrder: 'desc',
      });
      res.json({ total: result.total, actions: result.items });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  return router;
}
