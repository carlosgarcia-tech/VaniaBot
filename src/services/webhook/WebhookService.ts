/**
 * @fileoverview WebhookService.ts - Handles external subbot requests via webhook
 *
 * Manages subbot creation requests from external panels or services.
 * Handles pairing code generation and delivery via callbacks.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @created 2026-04-03
 * @module services/webhook/WebhookService
 */

import { subBotDatabase } from '@/services/subbot/SubBotDatabase.js';
import { subBotManager } from '@/services/subbot/SubBotManager.js';
import { logger, logError } from '@/utils/logger.js';

/**
 * Incoming webhook request data.
 *
 * @interface WebhookRequest
 * @property {string} requestToken - Unique identifier for the request
 * @property {string} phoneNumber - Phone number to link to subbot
 * @property {string} [subbotName] - Optional display name for subbot
 * @property {string} [ownerName] - Optional owner display name
 * @property {string} [ownerJid] - Optional owner WhatsApp JID
 */
export interface WebhookRequest {
  requestToken: string;
  phoneNumber: string;
  subbotName?: string;
  ownerName?: string;
  ownerJid?: string;
}

/**
 * Response returned after processing a webhook request.
 *
 * @interface WebhookResponse
 * @property {boolean} success - Whether the request was successful
 * @property {string} [requestToken] - The request identifier
 * @property {string} [pairingCode] - Generated pairing code (if ready)
 * @property {string} [message] - Status or error message
 * @property {number} [slot] - Assigned slot number
 * @property {string} [subbotId] - Subbot instance identifier
 */
export interface WebhookResponse {
  success: boolean;
  requestToken?: string;
  pairingCode?: string;
  message?: string;
  slot?: number;
  subbotId?: string;
}

/**
 * Status of a webhook request.
 *
 * @interface WebhookStatus
 * @property {string} requestToken - Request identifier
 * @property {'pending'|'generating'|'ready'|'expired'|'cancelled'} status - Current status
 * @property {string} phoneNumber - Associated phone number
 * @property {string} [subbotName] - Subbot display name
 * @property {string} [ownerName] - Owner display name
 * @property {string} [ownerJid] - Owner WhatsApp JID
 * @property {number} createdAt - Timestamp when request was created
 * @property {number} expiresAt - Timestamp when request expires
 * @property {string} [pairingCode] - Generated pairing code
 * @property {number} [slot] - Assigned slot number
 * @property {string} [subbotId] - Subbot instance ID
 */
export interface WebhookStatus {
  requestToken: string;
  status: 'pending' | 'generating' | 'ready' | 'expired' | 'cancelled';
  phoneNumber: string;
  subbotName?: string;
  ownerName?: string;
  ownerJid?: string;
  createdAt: number;
  expiresAt: number;
  pairingCode?: string;
  slot?: number;
  subbotId?: string;
}

/**
 * WebhookService class - Manages external subbot requests.
 *
 * Handles incoming webhook requests for creating subbots,
 * generates pairing codes, and sends callbacks to external services.
 *
 * @class WebhookService
 * @singleton
 * @example
 * const webhook = WebhookService.getInstance();
 * const result = await webhook.handleSubBotRequest({
 *   requestToken: 'unique-123',
 *   phoneNumber: '5215512345678',
 *   callbackUrl: 'https://mysite.com/webhook'
 * });
 */
export class WebhookService {
  private static instance: WebhookService;
  private pendingRequests = new Map<string, WebhookStatus>();
  private readonly REQUEST_EXPIRY_MS = 5 * 60 * 1000;
  private readonly CALLBACK_TIMEOUT_MS = 3 * 60 * 1000;

  /**
   * Creates a new WebhookService instance.
   * Use getInstance() for singleton pattern.
   *
   * @constructor
   * @private
   */
  private constructor() {}

  /**
   * Gets the singleton WebhookService instance.
   *
   * @method getInstance
   * @returns {WebhookService} The singleton instance
   * @static
   */
  static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  /**
   * Processes a new subbot request from an external panel.
   *
   * @method handleSubBotRequest
   * @param {WebhookRequest} request - The webhook request data
   * @param {string} [callbackUrl] - Optional URL to send pairing code to
   * @returns {Promise<WebhookResponse>} Result of processing the request
   * @example
   * const result = await webhookService.handleSubBotRequest({
   *   requestToken: 'req-123',
   *   phoneNumber: '5215512345678',
   *   subbotName: 'MyBot',
   *   ownerName: 'John'
   * }, 'https://mysite.com/callback');
   */
  async handleSubBotRequest(
    request: WebhookRequest,
    callbackUrl?: string,
  ): Promise<WebhookResponse> {
    const { requestToken, phoneNumber, subbotName, ownerName, ownerJid } = request;

    if (!requestToken || !phoneNumber) {
      return {
        success: false,
        message: 'Missing requestToken or phoneNumber',
      };
    }

    if (this.pendingRequests.has(requestToken)) {
      const existing = this.pendingRequests.get(requestToken);
      if (!existing) {
        return { success: false, message: 'Request not found' };
      }
      if (existing.status === 'ready' && existing.pairingCode) {
        return {
          success: true,
          requestToken,
          pairingCode: existing.pairingCode,
          slot: existing.slot,
          message: 'Pairing code already generated',
        };
      }
      if (existing.status === 'pending' || existing.status === 'generating') {
        return {
          success: false,
          message: 'Request already in progress',
        };
      }
    }

    if (!subBotDatabase.isPublicRequestsEnabled()) {
      return {
        success: false,
        message: 'Public requests are disabled',
      };
    }

    const freeSlot = subBotDatabase.getFreeSlot();
    if (!freeSlot) {
      return {
        success: false,
        message: 'No available slots',
      };
    }

    const status: WebhookStatus = {
      requestToken,
      status: 'pending',
      phoneNumber,
      subbotName: subbotName || `VaniaBot-${freeSlot.slot}`,
      ownerName: ownerName || 'Panel User',
      ownerJid: ownerJid || `${phoneNumber}@s.whatsapp.net`,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.REQUEST_EXPIRY_MS,
    };

    this.pendingRequests.set(requestToken, status);
    this.scheduleExpiry(requestToken);

    logger.info(`Webhook: subbot request received for ${phoneNumber}, slot ${freeSlot.slot}`);

    try {
      const result = await subBotManager.requestSubBot(
        status.ownerJid || '',
        status.ownerName || '',
        phoneNumber,
        freeSlot.slot,
        true,
      );

      const instance = subBotManager['instances']?.get(result.subConfig?.id || '');
      if (instance) {
        instance.once('pairingCode', (code: string) => {
          void (async () => {
            status.status = 'ready';
            status.pairingCode = code;
            status.slot = freeSlot.slot;
            status.subbotId = result.subConfig?.id;

            logger.info(`Webhook: pairing code generated for ${requestToken}: ${code}`);

            if (callbackUrl) {
              await this.sendCallback(callbackUrl, status);
            }
          })();
        });
      }

      setTimeout(() => {
        void (async () => {
          if (status.status === 'pending') {
            const subConfig = result.subConfig;
            if (subConfig) {
              const instance = subBotManager['instances']?.get(subConfig.id);
              if (instance?.pairingCode) {
                status.status = 'ready';
                status.pairingCode = instance.pairingCode;
                status.slot = freeSlot.slot;
                status.subbotId = subConfig.id;

                if (callbackUrl) {
                  await this.sendCallback(callbackUrl, status);
                }
              }
            }
          }
        })();
      }, 10000);

      return {
        success: true,
        requestToken,
        slot: freeSlot.slot,
        message: 'Subbot request accepted, generating pairing code',
      };
    } catch (error) {
      logError('WebhookService.handleSubBotRequest', error);
      this.pendingRequests.delete(requestToken);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to process request',
      };
    }
  }

  /**
   * Gets the status of a webhook request.
   *
   * @method getStatus
   * @param {string} requestToken - The request identifier
   * @returns {WebhookStatus | null} Request status or null if not found
   */
  getStatus(requestToken: string): WebhookStatus | null {
    return this.pendingRequests.get(requestToken) || null;
  }

  /**
   * Cancels a pending webhook request.
   *
   * @method cancelRequest
   * @param {string} requestToken - The request identifier to cancel
   * @returns {Promise<boolean>} True if cancelled, false if not found
   */
  async cancelRequest(requestToken: string): Promise<boolean> {
    const status = this.pendingRequests.get(requestToken);
    if (!status) return false;

    if (status.status === 'ready' && status.subbotId) {
      try {
        await subBotManager.deleteSubBot(status.ownerJid || '', status.slot);
      } catch (error) {
        logError('[WebhookService]', error);
      }
    }

    status.status = 'cancelled';
    this.pendingRequests.delete(requestToken);
    return true;
  }

  /**
   * Gets all pending webhook requests.
   *
   * @method getAllPending
   * @returns {WebhookStatus[]} Array of pending requests
   */
  getAllPending(): WebhookStatus[] {
    return Array.from(this.pendingRequests.values()).filter(
      s => s.status === 'pending' || s.status === 'generating' || s.status === 'ready',
    );
  }

  /**
   * Gets webhook statistics.
   *
   * @method getStats
   * @returns {Object} Statistics about webhook requests and slots
   * @property {number} pending - Number of pending requests
   * @property {number} ready - Number of ready requests
   * @property {number} total - Total active requests
   * @property {number} availableSlots - Available subbot slots
   * @property {number} usedSlots - Used subbot slots
   */
  getStats(): {
    pending: number;
    ready: number;
    total: number;
    availableSlots: number;
    usedSlots: number;
  } {
    const requests = this.getAllPending();
    return {
      pending: requests.filter(r => r.status === 'pending' || r.status === 'generating').length,
      ready: requests.filter(r => r.status === 'ready').length,
      total: requests.length,
      availableSlots: subBotDatabase.getMaxSlots() - subBotDatabase.getUsedSlotCount(),
      usedSlots: subBotDatabase.getUsedSlotCount(),
    };
  }

  /**
   * Schedules automatic expiry for a request.
   *
   * @method scheduleExpiry
   * @param {string} requestToken - Request to schedule expiry for
   * @private
   */
  private scheduleExpiry(requestToken: string): void {
    setTimeout(() => {
      const status = this.pendingRequests.get(requestToken);
      if (status && status.status !== 'ready' && status.status !== 'cancelled') {
        status.status = 'expired';
        this.pendingRequests.delete(requestToken);
        logger.info(`Webhook: request ${requestToken} expired`);
      }
    }, this.REQUEST_EXPIRY_MS);
  }

  /**
   * Sends a callback to an external URL with the pairing code.
   *
   * @method sendCallback
   * @param {string} callbackUrl - URL to send the callback to
   * @param {WebhookStatus} status - The webhook status to send
   * @returns {Promise<void>}
   * @private
   */
  private async sendCallback(callbackUrl: string, status: WebhookStatus): Promise<void> {
    try {
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VaniaBot-Webhook/1.0',
        },
        body: JSON.stringify({
          event: 'pairingCodeReady',
          requestToken: status.requestToken,
          phoneNumber: status.phoneNumber,
          pairingCode: status.pairingCode,
          slot: status.slot,
          subbotId: status.subbotId,
          expiresAt: status.expiresAt,
        }),
      });

      if (!response.ok) {
        logger.warn(`Webhook callback failed: ${response.status}`);
      }
    } catch (error) {
      logger.warn(`Webhook callback error: ${error}`);
    }
  }

  /**
   * Cleans up expired and cancelled requests.
   *
   * @method cleanup
   */
  cleanup(): void {
    for (const [token, status] of this.pendingRequests) {
      if (status.status === 'expired' || status.status === 'cancelled') {
        this.pendingRequests.delete(token);
      }
    }
  }
}

/**
 * Singleton instance of WebhookService.
 * @type {WebhookService}
 */
export const webhookService = WebhookService.getInstance();
