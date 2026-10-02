/**
 * index.ts
 *
 * Barrel module re-exporting the services layer's public API.
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview Webhook module barrel export
 *
 * Re-exports the main classes from the webhook subsystem for convenient importing.
 *
 * @module services/webhook
 * @example
 * import { webhookService, panelServer } from '@/services/webhook';
 */

export { webhookService, WebhookService } from './WebhookService.js';
export type { WebhookRequest, WebhookResponse, WebhookStatus } from './WebhookService.js';

export { panelServer, PanelServer } from './PanelServer.js';
export type { PanelConfig } from './PanelServer.js';
