/**
 * BlackMarketService.test.ts
 *
 * Unit tests for the P2P black market: listing validation (unknown item,
 * item not in inventory, price above value), purchase with money transfer
 * and inventory handover, self-purchase block, insufficient funds,
 * cancellation with item refund, 24h expiry cleanup and price sorting.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Hoisted mock state -----------------------------------------------------

const { mockUserService, mockItemRegistry, users } = vi.hoisted(() => {
  const users = new Map<string, { jid: string; money: number; inventory: unknown[] }>();
  const mockUserService = {
    getUser: vi.fn(async (jid: string) => {
      if (!users.has(jid)) {
        users.set(jid, { jid, money: 0, inventory: [] });
      }
      return users.get(jid);
    }),
    addMoney: vi.fn(async (jid: string, amount: number) => {
      const u = users.get(jid);
      if (u) u.money += amount;
    }),
    removeMoney: vi.fn(async (jid: string, amount: number) => {
      const u = users.get(jid);
      if (u) u.money -= amount;
    }),
    removeItem: vi.fn(async (jid: string, itemId: string) => {
      const u = users.get(jid);
      if (!u) return;
      const idx = u.inventory.findIndex((i: { itemId: string }) => i.itemId === itemId);
      if (idx >= 0) u.inventory.splice(idx, 1);
    }),
    addItemToInventory: vi.fn(
      async (jid: string, item: unknown) => {
        users.get(jid)?.inventory.push(item);
      },
    ),
  };
  const mockItemRegistry = {
    getItem: vi.fn((itemId: string) => {
      const items: Record<string, { name: string; value: number; rarity?: string }> = {
        diamond: { name: 'Diamante', value: 2000, rarity: 'legendary' },
        iron: { name: 'Hierro', value: 200, rarity: 'rare' },
      };
      return items[itemId];
    }),
  };
  return { mockUserService, mockItemRegistry, users };
});

// --- Module mocks -----------------------------------------------------------

vi.mock('../../../src/services/system/Servicemanager.js', () => ({
  serviceManager: { userService: mockUserService },
}));

vi.mock('../../../src/services/rpg/ItemRegistry.js', () => ({
  itemRegistry: mockItemRegistry,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// --- Imports under test (after mocks) ---------------------------------------

import { blackMarketService } from '../../../src/services/economy/BlackMarketService.js';

const SELLER = 'seller@s.whatsapp.net';
const BUYER = 'buyer@s.whatsapp.net';

// --- Tests -----------------------------------------------------------------

describe('BlackMarketService', () => {
  let service: typeof blackMarketService;

  beforeEach(() => {
    service = blackMarketService;
    users.clear();
    // Reset del estado interno del singleton (la lista es privada)
    (service as unknown as { listings: unknown[] }).listings = [];
    vi.spyOn(Math, 'random').mockReturnValue(0.0); // descuento mínimo sugerido
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listar un item inexistente en el registro falla', async () => {
    const result = await service.listItem(SELLER, 'no-existe', 100);
    expect(result.success).toBe(false);
    expect(result.message).toContain('no válido');
  });

  it('listar sin tener el item en el inventario falla', async () => {
    await mockUserService.getUser(SELLER);
    const result = await service.listItem(SELLER, 'diamond', 1000);
    expect(result.success).toBe(false);
    expect(result.message).toContain('No tienes ese item');
  });

  it('listar con precio sobre el valor original falla', async () => {
    const seller = await mockUserService.getUser(SELLER);
    seller.inventory.push({ itemId: 'diamond', name: 'Diamante' });

    const result = await service.listItem(SELLER, 'diamond', 2500);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Precio muy alto');
  });

  it('listado válido: remueve el item del vendedor y crea el listing', async () => {
    const seller = await mockUserService.getUser(SELLER);
    seller.inventory.push({ itemId: 'iron', name: 'Hierro' });

    const result = await service.listItem(SELLER, 'iron', 150);

    expect(result.success).toBe(true);
    expect(result.listing?.itemId).toBe('iron');
    expect(result.listing?.sellPrice).toBe(150);
    expect(result.listing?.rarity).toBe('rare');
    expect(seller.inventory).toHaveLength(0);
    expect(service.getListings()).toHaveLength(1);
  });

  it('buyItem transfiere dinero e inventario y retira el listing', async () => {
    const seller = await mockUserService.getUser(SELLER);
    seller.inventory.push({ itemId: 'iron', name: 'Hierro' });
    seller.money = 0;
    const { listing } = await service.listItem(SELLER, 'iron', 150);

    const buyer = await mockUserService.getUser(BUYER);
    buyer.money = 500;

    const result = await service.buyItem(BUYER, listing!.id);

    expect(result.success).toBe(true);
    expect(buyer.money).toBe(350);
    expect(seller.money).toBe(150);
    expect(buyer.inventory.some((i: { itemId: string }) => i.itemId === 'iron')).toBe(true);
    expect(service.getListings()).toHaveLength(0);
  });

  it('buyItem bloquea comprar tu propio listing', async () => {
    const seller = await mockUserService.getUser(SELLER);
    seller.inventory.push({ itemId: 'iron', name: 'Hierro' });
    const { listing } = await service.listItem(SELLER, 'iron', 100);

    const result = await service.buyItem(SELLER, listing!.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain('tu propio item');
  });

  it('buyItem rechaza sin fondos suficientes', async () => {
    const seller = await mockUserService.getUser(SELLER);
    seller.inventory.push({ itemId: 'diamond', name: 'Diamante' });
    const { listing } = await service.listItem(SELLER, 'diamond', 1900);

    const buyer = await mockUserService.getUser(BUYER);
    buyer.money = 100;

    const result = await service.buyItem(BUYER, listing!.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain('No tienes suficiente dinero');
    expect(service.getListings()).toHaveLength(1);
  });

  it('buyItem con listing inexistente falla', async () => {
    const result = await service.buyItem(BUYER, 'no-existe');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('cancelListing devuelve el item al vendedor', async () => {
    const seller = await mockUserService.getUser(SELLER);
    seller.inventory.push({ itemId: 'iron', name: 'Hierro' });
    const { listing } = await service.listItem(SELLER, 'iron', 100);

    const result = await service.cancelListing(SELLER, listing!.id);

    expect(result.success).toBe(true);
    expect(seller.inventory).toHaveLength(1);
    expect(service.getListings()).toHaveLength(0);
  });

  it('cancelListing solo permite al dueño y solo si existe', async () => {
    const seller = await mockUserService.getUser(SELLER);
    seller.inventory.push({ itemId: 'iron', name: 'Hierro' });
    const { listing } = await service.listItem(SELLER, 'iron', 100);

    const notOwner = await service.cancelListing(BUYER, listing!.id);
    expect(notOwner.success).toBe(false);

    const fake = await service.cancelListing(SELLER, 'fake-id');
    expect(fake.success).toBe(false);
  });

  it('los listings expirados se limpian automáticamente (24h)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));

    const seller = await mockUserService.getUser(SELLER);
    seller.inventory.push({ itemId: 'iron', name: 'Hierro' });
    await service.listItem(SELLER, 'iron', 100);
    expect(service.getListings()).toHaveLength(1);

    // 25 horas después: expiró
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(service.getListings()).toHaveLength(0);

    vi.useRealTimers();
  });

  it('getListings ordena por precio de venta ascendente', async () => {
    const s1 = await mockUserService.getUser('s1@x');
    const s2 = await mockUserService.getUser('s2@x');
    const s3 = await mockUserService.getUser('s3@x');
    s1.inventory.push({ itemId: 'diamond', name: 'Diamante' });
    s2.inventory.push({ itemId: 'iron', name: 'Hierro' });
    s3.inventory.push({ itemId: 'iron', name: 'Hierro' });

    await service.listItem('s1@x', 'diamond', 1800);
    await service.listItem('s2@x', 'iron', 50);
    await service.listItem('s3@x', 'iron', 150);

    const prices = service.getListings().map(l => l.sellPrice);
    expect(prices).toEqual([50, 150, 1800]);
  });

  it('getUserListings filtra por vendedor', async () => {
    const s1 = await mockUserService.getUser('s1@x');
    const s2 = await mockUserService.getUser('s2@x');
    s1.inventory.push({ itemId: 'iron', name: 'Hierro' });
    s2.inventory.push({ itemId: 'iron', name: 'Hierro' });

    await service.listItem('s1@x', 'iron', 100);
    await service.listItem('s2@x', 'iron', 120);

    expect(service.getUserListings('s1@x')).toHaveLength(1);
  });

  it('getRandomItems devuelve hasta 8 items del catálogo', () => {
    const items = service.getRandomItems();
    expect(items.length).toBeLessThanOrEqual(8);
    expect(items[0]).toHaveProperty('itemId');
    expect(items[0]).toHaveProperty('minPrice');
    expect(items[0]).toHaveProperty('maxPrice');
  });
});
