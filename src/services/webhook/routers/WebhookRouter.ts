import { Router } from 'express';
import type { Request, Response } from 'express';
import { webhookService } from '../WebhookService.js';
import { logger } from '@/utils/logger.js';

export function createWebhookRouter(webhookToken: string): Router {
  const router = Router();

  function validateToken(req: Request): boolean {
    const token = req.headers['x-bot-webhook-token'] as string;
    // Fail closed: if no token is configured, reject everything. Otherwise
    // anyone could create/cancel subbots on an unauthenticated panel.
    if (!webhookToken) return false;
    return token === webhookToken;
  }

  router.post('/request', async (req: Request, res: Response) => {
    if (!validateToken(req)) {
      res.status(401).json({ success: false, message: 'Invalid webhook token' });
      return;
    }

    const { requestToken, phoneNumber, subbotName, ownerName, callbackUrl } = req.body;
    if (!requestToken || !phoneNumber) {
      res.status(400).json({ success: false, message: 'Missing requestToken or phoneNumber' });
      return;
    }

    try {
      const result = await webhookService.handleSubBotRequest(
        { requestToken, phoneNumber, subbotName, ownerName },
        callbackUrl,
      );
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Webhook request error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  router.get('/status/:requestToken', (req: Request, res: Response) => {
    if (!validateToken(req)) {
      res.status(401).json({ success: false, message: 'Invalid webhook token' });
      return;
    }

    const requestToken = req.params.requestToken as string;
    const status = webhookService.getStatus(requestToken);

    if (!status) {
      res.status(404).json({ success: false, message: 'Request not found' });
      return;
    }

    res.json({
      success: true,
      status: {
        requestToken: status.requestToken,
        status: status.status,
        phoneNumber: status.phoneNumber,
        pairingCode: status.pairingCode,
        slot: status.slot,
        expiresAt: status.expiresAt,
      },
    });
  });

  router.post('/cancel/:requestToken', async (req: Request, res: Response) => {
    if (!validateToken(req)) {
      res.status(401).json({ success: false, message: 'Invalid webhook token' });
      return;
    }

    const requestToken = req.params.requestToken as string;
    const cancelled = await webhookService.cancelRequest(requestToken);

    if (cancelled) {
      res.json({ success: true, message: 'Request cancelled' });
    } else {
      res.status(404).json({ success: false, message: 'Request not found' });
    }
  });

  return router;
}
