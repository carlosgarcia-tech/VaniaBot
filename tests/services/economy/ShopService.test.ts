/**
 * ShopService.test.ts
 *
 * Unit tests for the shop catalog: catalog integrity (unique IDs, positive
 * prices, valid types, duration consistency), lookup by ID / 1-based index /
 * type, and singleton behavior.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ShopService, shopService } from '../../../src/services/economy/ShopService.js';
import type { ShopItem } from '../../../src/services/economy/ShopService.js';

const VALID_TYPES: ShopItem['type'][] = ['role', 'feature', 'cosmetic', 'badge'];

describe('ShopService', () => {
  let service: ShopService;

  beforeEach(() => {
    service = ShopService.getInstance();
  });

  it('es un singleton: getInstance siempre devuelve la misma instancia', () => {
    expect(ShopService.getInstance()).toBe(shopService);
    expect(ShopService.getInstance()).toBe(service);
  });

  it('el catálogo tiene items con datos completos', () => {
    const items = service.getItems();

    expect(items.length).toBeGreaterThanOrEqual(10);
    for (const item of items) {
      expect(item.id, `item sin id: ${JSON.stringify(item)}`).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.emoji).toBeTruthy();
      expect(item.price).toBeGreaterThan(0);
    }
  });

  it('los IDs del catálogo son únicos', () => {
    const items = service.getItems();
    const ids = items.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todos los items tienen un tipo válido', () => {
    for (const item of service.getItems()) {
      expect(VALID_TYPES).toContain(item.type);
    }
  });

  it('los items con duración usan valores razonables (1h..30d)', () => {
    const HOUR = 60 * 60 * 1000;
    for (const item of service.getItems()) {
      if (item.duration !== undefined) {
        expect(
          item.duration,
          `${item.id}: duración fuera de rango`,
        ).toBeGreaterThanOrEqual(HOUR);
        expect(item.duration).toBeLessThanOrEqual(30 * 24 * HOUR);
      }
    }
  });

  it('getItemById encuentra por id exacto y devuelve undefined para desconocidos', () => {
    expect(service.getItemById('vip_role')?.name).toBe('VIP Role');
    expect(service.getItemById('no-existe')).toBeUndefined();
  });

  it('getItemByIndex es 1-based (índice 0 no existe)', () => {
    const items = service.getItems();
    expect(service.getItemByIndex(1)).toBe(items[0]);
    expect(service.getItemByIndex(items.length)).toBe(items[items.length - 1]);
    expect(service.getItemByIndex(0)).toBeUndefined();
    expect(service.getItemByIndex(items.length + 1)).toBeUndefined();
  });

  it('getItemsByType filtra correctamente', () => {
    const roles = service.getItemsByType('role');
    expect(roles.length).toBeGreaterThan(0);
    expect(roles.every(i => i.type === 'role')).toBe(true);

    const badges = service.getItemsByType('badge');
    expect(badges.every(i => i.type === 'badge')).toBe(true);

    // Tipo sin items también devuelve array vacío, no error
    expect(service.getItemsByType('cosmetic')).toBeInstanceOf(Array);
  });

  it('precios escalan por rareza de rol (VIP < Legend)', () => {
    const vip = service.getItemById('vip_role');
    const legend = service.getItemById('legend_role');
    expect(vip && legend ? legend.price > vip.price : true).toBe(true);
  });
});
