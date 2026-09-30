/**
 * LoanService.test.ts
 *
 * Unit tests for the P2P loan service: amount validation, insufficient
 * funds, single pending loan per borrower, the full request → accept →
 * repay lifecycle with money transfers, rejection, 10% interest math,
 * overdue detection (defaulted) and persistence through GameStateService.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Hoisted mock state -----------------------------------------------------

const { mockUserService, mockGameStateService } = vi.hoisted(() => ({
  mockUserService: {
    getUser: vi.fn(),
    addMoney: vi.fn(async () => {}),
    removeMoney: vi.fn(async () => {}),
  },
  mockGameStateService: {
    getLoans: vi.fn(() => []),
    setLoans: vi.fn(),
  },
}));

// --- Module mocks -----------------------------------------------------------

vi.mock('../../../src/services/system/Servicemanager.js', () => ({
  serviceManager: { userService: mockUserService },
}));

vi.mock('../../../src/services/rpg/GameStateService.js', () => ({
  gameStateService: mockGameStateService,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// --- Imports under test (after mocks) ---------------------------------------

import { loanService } from '../../../src/services/economy/LoanService.js';

const LENDER = 'lender@s.whatsapp.net';
const BORROWER = 'borrower@s.whatsapp.net';

function userWith(jid: string, money: number): void {
  mockUserService.getUser.mockImplementation(async (target: string) => {
    if (target === jid) return { jid, money };
    return { jid: 'other', money: 0 };
  });
}

// --- Tests -----------------------------------------------------------------

describe('LoanService', () => {
  let service: LoanService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
    service = loanService;
    // Reset del estado interno del singleton vía la misma vía de persistencia
    mockGameStateService.getLoans.mockReturnValue([]);
    service.loadFromPersistence();
    mockUserService.getUser.mockResolvedValue({ jid: 'x', money: 0 });
    mockUserService.addMoney.mockClear();
    mockUserService.removeMoney.mockClear();
    mockGameStateService.setLoans.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rechaza montos fuera de los límites [1000, 100000]', async () => {
    userWith(LENDER, 1_000_000);

    const tooLow = await service.requestLoan(LENDER, BORROWER, 500);
    expect(tooLow.success).toBe(false);
    expect(tooLow.message).toContain('mínimo es $1000');

    const tooHigh = await service.requestLoan(LENDER, BORROWER, 200_000);
    expect(tooHigh.success).toBe(false);
    expect(tooHigh.message).toContain('máximo es $100000');
  });

  it('rechaza si el prestamista no tiene fondos', async () => {
    userWith(LENDER, 500);

    const result = await service.requestLoan(LENDER, BORROWER, 1000);
    expect(result.success).toBe(false);
    expect(result.message).toContain('No tienes suficiente dinero');
  });

  it('solicitud válida: crea préstamo pending con 10% de interés', async () => {
    userWith(LENDER, 50_000);

    const result = await service.requestLoan(LENDER, BORROWER, 10_000);

    expect(result.success).toBe(true);
    expect(result.loanId).toMatch(/^PR-\d{4}$/);

    const loan = service.getLoanById(result.loanId!);
    expect(loan?.status).toBe('pending');
    expect(loan?.amount).toBe(10_000);
    expect(loan?.totalToRepay).toBe(11_000);
    expect(loan?.lenderJid).toBe(LENDER);
    expect(loan?.borrowerJid).toBe(BORROWER);
    expect(mockGameStateService.setLoans).toHaveBeenCalledTimes(1);
  });

  it('un borrower no puede tener dos solicitudes pendientes', async () => {
    userWith(LENDER, 50_000);

    await service.requestLoan(LENDER, BORROWER, 1000);
    const second = await service.requestLoan(LENDER, BORROWER, 2000);

    expect(second.success).toBe(false);
    expect(second.message).toContain('pendiente');
  });

  it('acceptLoan solo lo puede aceptar el borrower y solo si está pending', async () => {
    userWith(LENDER, 50_000);
    const { loanId } = await service.requestLoan(LENDER, BORROWER, 5000);

    const wrongUser = await service.acceptLoan('intruso@x', loanId!);
    expect(wrongUser.success).toBe(false);
    expect(wrongUser.message).toContain('no es tuyo');

    // Ya aceptado no se puede re-aceptar
    userWith(LENDER, 50_000);
    await service.acceptLoan(BORROWER, loanId!);
    const again = await service.acceptLoan(BORROWER, loanId!);
    expect(again.success).toBe(false);
    expect(again.message).toContain('ya fue procesado');
  });

  it('acceptLoan transfiere el dinero lender→borrower y activa el préstamo', async () => {
    userWith(LENDER, 50_000);
    const { loanId } = await service.requestLoan(LENDER, BORROWER, 5000);

    userWith(LENDER, 50_000);
    const result = await service.acceptLoan(BORROWER, loanId!);

    expect(result.success).toBe(true);
    expect(mockUserService.removeMoney).toHaveBeenCalledWith(LENDER, 5000);
    expect(mockUserService.addMoney).toHaveBeenCalledWith(BORROWER, 5000);

    const loan = service.getLoanById(loanId!);
    expect(loan?.status).toBe('active');
    expect(loan?.remaining).toBe(5500);
    // Vence en 7 días
    expect(loan?.dueDate).toBe(Date.now() + 7 * 24 * 60 * 60 * 1000);
  });

  it('acceptLoan rechaza si el lender ya no tiene fondos y marca rejected', async () => {
    userWith(LENDER, 50_000);
    const { loanId } = await service.requestLoan(LENDER, BORROWER, 5000);

    userWith(LENDER, 100); // el lender gastó su dinero mientras tanto
    const result = await service.acceptLoan(BORROWER, loanId!);

    expect(result.success).toBe(false);
    expect(result.message).toContain('ya no tiene suficiente dinero');
    expect(service.getLoanById(loanId!)?.status).toBe('rejected');
  });

  it('repayLoan transfiere el total con intereses al lender y cierra el préstamo', async () => {
    userWith(LENDER, 50_000);
    const { loanId } = await service.requestLoan(LENDER, BORROWER, 5000);
    userWith(LENDER, 50_000);
    await service.acceptLoan(BORROWER, loanId!);

    // El borrower recibió 5000 y ahorró 5500 para pagar
    userWith(BORROWER, 6000);

    const result = await service.repayLoan(BORROWER, loanId!);

    expect(result.success).toBe(true);
    expect(mockUserService.removeMoney).toHaveBeenCalledWith(BORROWER, 5500);
    expect(mockUserService.addMoney).toHaveBeenCalledWith(LENDER, 5500);

    const loan = service.getLoanById(loanId!);
    expect(loan?.status).toBe('paid');
    expect(loan?.remaining).toBe(0);
  });

  it('repayLoan rechaza si el borrower no alcanza el total', async () => {
    userWith(LENDER, 50_000);
    const { loanId } = await service.requestLoan(LENDER, BORROWER, 5000);
    userWith(LENDER, 50_000);
    await service.acceptLoan(BORROWER, loanId!);

    userWith(BORROWER, 1000);
    const result = await service.repayLoan(BORROWER, loanId!);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Necesitas: $5500');
    expect(service.getLoanById(loanId!)?.status).toBe('active');
  });

  it('rejectLoan marca rejected y puede consultarse', async () => {
    userWith(LENDER, 50_000);
    const { loanId } = await service.requestLoan(LENDER, BORROWER, 5000);

    const result = await service.rejectLoan(BORROWER, loanId!);

    expect(result.success).toBe(true);
    expect(service.getLoanById(loanId!)?.status).toBe('rejected');
    expect(mockUserService.removeMoney).not.toHaveBeenCalled();
  });

  it('checkOverdueLoans marca defaulted los vencidos y devuelve la lista', async () => {
    userWith(LENDER, 50_000);
    const { loanId } = await service.requestLoan(LENDER, BORROWER, 5000);
    userWith(LENDER, 50_000);
    await service.acceptLoan(BORROWER, loanId!);

    // Avanza 8 días: el préstamo vence
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

    const overdue = service.checkOverdueLoans();

    expect(overdue).toHaveLength(1);
    expect(overdue[0].id).toBe(loanId);
    expect(overdue[0].status).toBe('defaulted');

    // Segunda llamada: ya no hay cambios pendientes
    expect(service.checkOverdueLoans()).toHaveLength(0);
  });

  it('los getters filtran por rol y estado', async () => {
    userWith(LENDER, 50_000);
    const { loanId } = await service.requestLoan(LENDER, BORROWER, 5000);

    expect(service.getPendingLoans(BORROWER)).toHaveLength(1);
    expect(service.getPendingLoans(LENDER)).toHaveLength(0);
    expect(service.getLoansAsLender(LENDER)).toHaveLength(1);

    userWith(LENDER, 50_000);
    await service.acceptLoan(BORROWER, loanId!);

    expect(service.getActiveLoans(BORROWER)).toHaveLength(1);
    expect(service.getActiveLoans(LENDER)).toHaveLength(1);
    expect(service.getPendingLoans(BORROWER)).toHaveLength(0);
  });

  it('formatLoanDetails formatea según el estado', async () => {
    userWith(LENDER, 50_000);
    const { loanId } = await service.requestLoan(LENDER, BORROWER, 5000);

    const pending = service.formatLoanDetails(loanId!);
    expect(pending).toContain('PENDING');
    expect(pending).toContain('$5000');
    expect(pending).toContain('aceptar');

    expect(service.formatLoanDetails('PR-9999')).toBeNull();
  });

  it('loadFromPersistence restaura préstamos y continúa el contador de IDs', () => {
    mockGameStateService.getLoans.mockReturnValue([
      {
        id: 'PR-0041',
        lenderJid: LENDER,
        borrowerJid: BORROWER,
        amount: 1000,
        interestRate: 0.1,
        totalToRepay: 1100,
        remaining: 1100,
        createdAt: 0,
        dueDate: 0,
        status: 'active',
      },
    ]);

    service.loadFromPersistence();

    expect(service.getLoanById('PR-0041')).toBeDefined();

    // El siguiente ID continúa desde el mayor cargado
    mockUserService.getUser.mockResolvedValue({ jid: 'x', money: 999_999 });
    return service.requestLoan(LENDER, BORROWER, 1000).then(r => {
      expect(r.loanId).toBe('PR-0042');
    });
  });
});
