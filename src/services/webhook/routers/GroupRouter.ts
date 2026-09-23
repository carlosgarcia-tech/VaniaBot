import { Router } from 'express';
import type { Request, Response } from 'express';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { requireApiToken } from './auth.js';

export function createGroupRouter(webhookToken: string): Router {
  const router = Router();

  // Groups expose JIDs, member counts and configuration; the dashboard must
  // send the token in the `x-api-token` header.
  router.use(requireApiToken(webhookToken));

  router.get('/', async (_req: Request, res: Response) => {
    try {
      if (!serviceManager.groupService) {
        res.status(501).json({ error: 'Service not available' });
        return;
      }
      const groups = await serviceManager.groupService.getAllGroups();
      const groupsWithStats = groups.map(g => ({
        jid: g.jid,
        name: g.name,
        isActive: g.isActive,
        onlyAdmin: g.onlyAdmin,
        welcome: g.welcome.enabled,
        goodbye: g.goodbye.enabled,
        antiLink: g.antiLink.enabled,
        antiSpam: g.antiSpam.enabled,
        stats: g.stats,
      }));
      res.json({
        total: groups.length,
        active: groups.filter(g => g.isActive).length,
        groups: groupsWithStats,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.get('/:jid', async (req: Request, res: Response) => {
    try {
      if (!serviceManager.groupService) {
        res.status(501).json({ error: 'Service not available' });
        return;
      }
      const jid = String(req.params.jid);
      const group = await serviceManager.groupService.getGroup(jid);
      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      res.json(group);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  return router;
}
