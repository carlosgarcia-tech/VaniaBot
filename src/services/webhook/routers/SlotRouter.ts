import { Router } from 'express';
import type { Request, Response } from 'express';
import { subBotDatabase } from '@/services/subbot/SubBotDatabase.js';
import { subBotManager } from '@/services/subbot/SubBotManager.js';
import type { SubBotSlot } from '@/types/subbot.js';
import { requireApiToken } from './auth.js';

/**
 * Masks PII (owner JID, full phone number) for unauthenticated GET responses.
 * The dashboard only needs status/name plus a partially-masked phone.
 */
function sanitizeSlot(slot: SubBotSlot): Record<string, unknown> {
  const phone = slot.phoneNumber || '';
  const maskedPhone =
    phone.length > 10 ? `${phone.slice(0, 6)}****${phone.slice(-4)}` : phone ? '****' : '';
  return {
    slot: slot.slot,
    status: slot.status,
    ownerName: slot.ownerName ?? null,
    name: slot.name ?? null,
    phoneNumber: maskedPhone || null,
    connectedAt: slot.connectedAt ?? null,
    // ownerJid intentionally omitted: not needed by the dashboard.
  };
}

export function createSlotRouter(webhookToken: string): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    const slots = subBotDatabase.getAllSlots();
    res.json({
      maxSlots: subBotDatabase.getMaxSlots(),
      slots: slots.map(s => sanitizeSlot(s)),
    });
  });

  router.get('/:slot', (req: Request, res: Response) => {
    const slotNumber = parseInt(req.params.slot as string);
    const slot = subBotDatabase.getSlot(slotNumber);

    if (!slot) {
      res.status(404).json({ success: false, message: 'Slot not found' });
      return;
    }

    res.json({
      success: true,
      slot: {
        ...sanitizeSlot(slot),
        bio: slot.bio,
        requestedAt: slot.requestedAt,
      },
    });
  });

  // Mutating endpoints require the API token (header or ?token= query).
  router.use(requireApiToken(webhookToken));

  router.post('/:slot/reconnect', async (req: Request, res: Response) => {
    const slotNumber = parseInt(req.params.slot as string);
    const slot = subBotDatabase.getSlot(slotNumber);

    if (!slot || !slot.ownerJid) {
      res.status(404).json({ success: false, message: 'Slot not found or empty' });
      return;
    }

    try {
      await subBotManager.reconnectByOwner(slot.ownerJid, slotNumber);
      res.json({ success: true, message: 'Reconnection initiated' });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: error instanceof Error ? error.message : 'Error' });
    }
  });

  router.post('/:slot/release', async (req: Request, res: Response) => {
    const slotNumber = parseInt(req.params.slot as string);
    const slot = subBotDatabase.getSlot(slotNumber);

    if (!slot || !slot.ownerJid) {
      res.status(404).json({ success: false, message: 'Slot not found or empty' });
      return;
    }

    try {
      await subBotManager.deleteSubBot(slot.ownerJid, slotNumber);
      res.json({ success: true, message: 'Slot released' });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: error instanceof Error ? error.message : 'Error' });
    }
  });

  return router;
}
