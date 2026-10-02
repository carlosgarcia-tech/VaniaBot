/**
 * index.ts
 *
 * Barrel module re-exporting the services layer's public API.
 *
 * @author **Carlos G**
 */

export {
  normalizeJid,
  getBotJid,
  getBotLid,
  getBotPhone,
  isLidJid,
  extractPhone,
} from './JidService.js';
export { GroupMetadataCache } from './GroupMetadataCache.js';
export { LidResolver } from './LidResolver.js';
export { UserPermissionChecker, type UserPermissions } from './UserPermissionChecker.js';
export { BotPermissionChecker, type BotPermissions } from './BotPermissionChecker.js';
