/**
 * LoanService.ts
 *
 * VaniaBot services module exposing `Loan`, `loanService`.
 *
 * @author **Carlos G**
 */

import { serviceManager } from '../system/Servicemanager.js';
import { gameStateService } from '../rpg/GameStateService.js';
import { logger } from '@/utils/logger.js';

export interface Loan {
  id: string;
  lenderJid: string;
  borrowerJid: string;
  amount: number;
  interestRate: number;
  totalToRepay: number;
  remaining: number;
  createdAt: number;
  dueDate: number;
  status: 'pending' | 'active' | 'rejected' | 'paid' | 'defaulted';
}

class LoanService {
  private static instance: LoanService;
  private loans: Map<string, Loan> = new Map();
  private loanCounter = 1;
  private readonly MIN_LOAN = 1000;
  private readonly MAX_LOAN = 100000;
  private readonly INTEREST_RATE = 0.1;
  private readonly LOAN_DURATION = 7 * 24 * 60 * 60 * 1000;

  static getInstance(): LoanService {
    if (!LoanService.instance) {
      LoanService.instance = new LoanService();
    }
    return LoanService.instance;
  }

  loadFromPersistence(): void {
    const savedLoans = gameStateService.getLoans();
    this.loans.clear();
    let maxNum = 0;
    for (const loan of savedLoans) {
      this.loans.set(loan.id, {
        id: loan.id,
        lenderJid: loan.lenderJid,
        borrowerJid: loan.borrowerJid,
        amount: loan.amount,
        interestRate: loan.interestRate,
        totalToRepay: loan.totalToRepay,
        remaining: loan.remaining,
        createdAt: loan.createdAt,
        dueDate: loan.dueDate,
        status: loan.status as Loan['status'],
      });
      const num = parseInt(loan.id.replace('PR-', ''));
      if (num > maxNum) maxNum = num;
    }
    this.loanCounter = maxNum + 1;
    logger.debug(`[Loan] Loaded ${this.loans.size} loans`);
  }

  private saveLoans(): void {
    const loans = Array.from(this.loans.values()).map(l => ({
      id: l.id,
      lenderJid: l.lenderJid,
      borrowerJid: l.borrowerJid,
      amount: l.amount,
      interestRate: l.interestRate,
      totalToRepay: l.totalToRepay,
      remaining: l.remaining,
      createdAt: l.createdAt,
      dueDate: l.dueDate,
      status: l.status,
    }));
    gameStateService.setLoans(loans);
  }

  private generateLoanId(): string {
    const id = `PR-${this.loanCounter.toString().padStart(4, '0')}`;
    this.loanCounter++;
    return id;
  }

  async requestLoan(
    lenderJid: string,
    borrowerJid: string,
    amount: number,
  ): Promise<{ success: boolean; message: string; loanId?: string }> {
    if (amount < this.MIN_LOAN) {
      return { success: false, message: `❌ El mínimo es $${this.MIN_LOAN}` };
    }

    if (amount > this.MAX_LOAN) {
      return { success: false, message: `❌ El máximo es $${this.MAX_LOAN}` };
    }

    const lender = await serviceManager.userService.getUser(lenderJid);
    if (lender.money < amount) {
      return { success: false, message: `❌ No tienes suficiente dinero` };
    }

    await serviceManager.userService.getUser(borrowerJid);
    const existingLoan = Array.from(this.loans.values()).find(
      l => l.borrowerJid === borrowerJid && l.status === 'pending',
    );

    if (existingLoan) {
      return { success: false, message: `❌ Ya tienes una solicitud de préstamo pendiente` };
    }

    const loanId = this.generateLoanId();
    const interest = Math.floor(amount * this.INTEREST_RATE);
    const totalToRepay = amount + interest;

    const loan: Loan = {
      id: loanId,
      lenderJid,
      borrowerJid,
      amount,
      interestRate: this.INTEREST_RATE,
      totalToRepay,
      remaining: totalToRepay,
      createdAt: Date.now(),
      dueDate: 0,
      status: 'pending',
    };

    this.loans.set(loanId, loan);
    this.saveLoans();

    return {
      success: true,
      message: `📋 *Solicitud de préstamo enviada!*\n\n💰 Cantidad: $${amount}\n📈 Interés: ${this.INTEREST_RATE * 100}%\n💸 Total a pagar: $${totalToRepay}\n\nEl usuario debe aceptar con: !prestamo aceptar ${loanId}`,
      loanId,
    };
  }

  async acceptLoan(
    borrowerJid: string,
    loanId: string,
  ): Promise<{ success: boolean; message: string }> {
    const loan = this.loans.get(loanId);

    if (!loan) {
      return { success: false, message: '❌ Préstamo no encontrado' };
    }

    if (loan.borrowerJid !== borrowerJid) {
      return { success: false, message: '❌ Este préstamo no es tuyo' };
    }

    if (loan.status !== 'pending') {
      return { success: false, message: `❌ Este préstamo ya fue procesado (${loan.status})` };
    }

    const lender = await serviceManager.userService.getUser(loan.lenderJid);
    if (lender.money < loan.amount) {
      loan.status = 'rejected';
      this.saveLoans();
      return { success: false, message: '❌ El prestamista ya no tiene suficiente dinero' };
    }

    await serviceManager.userService.removeMoney(loan.lenderJid, loan.amount);
    await serviceManager.userService.addMoney(loan.borrowerJid, loan.amount);

    loan.status = 'active';
    loan.dueDate = Date.now() + this.LOAN_DURATION;
    loan.remaining = loan.totalToRepay;
    this.saveLoans();

    return {
      success: true,
      message: `✅ *Préstamo aceptado!*\n\n💰 Recibiste: $${loan.amount}\n📈 Interés: ${loan.interestRate * 100}%\n💸 Total a pagar: $${loan.totalToRepay}\n⏰ Vence en: 7 días\n\n🆔 ID: \`${loan.id}\`\nUsa !prestamo pagar ${loan.id} para pagar`,
    };
  }

  async rejectLoan(
    borrowerJid: string,
    loanId: string,
  ): Promise<{ success: boolean; message: string }> {
    const loan = this.loans.get(loanId);

    if (!loan) {
      return { success: false, message: '❌ Préstamo no encontrado' };
    }

    if (loan.borrowerJid !== borrowerJid) {
      return { success: false, message: '❌ Este préstamo no es tuyo' };
    }

    if (loan.status !== 'pending') {
      return { success: false, message: `❌ Este préstamo ya fue procesado` };
    }

    loan.status = 'rejected';
    this.saveLoans();

    return {
      success: true,
      message: `❌ *Préstamo rechazado*\n\nLa solicitud de préstamo ha sido cancelada.`,
    };
  }

  async repayLoan(
    borrowerJid: string,
    loanId: string,
  ): Promise<{ success: boolean; message: string }> {
    const loan = this.loans.get(loanId);

    if (!loan) {
      return { success: false, message: '❌ Préstamo no encontrado' };
    }

    if (loan.borrowerJid !== borrowerJid) {
      return { success: false, message: '❌ Este préstamo no es tuyo' };
    }

    if (loan.status !== 'active') {
      return { success: false, message: `❌ Este préstamo no está activo` };
    }

    const borrower = await serviceManager.userService.getUser(borrowerJid);
    if (borrower.money < loan.totalToRepay) {
      return {
        success: false,
        message: `❌ No tienes suficiente dinero. Necesitas: $${loan.totalToRepay}\nTienes: $${borrower.money}`,
      };
    }

    await serviceManager.userService.removeMoney(borrowerJid, loan.totalToRepay);
    await serviceManager.userService.addMoney(loan.lenderJid, loan.totalToRepay);

    loan.status = 'paid';
    loan.remaining = 0;
    this.saveLoans();

    return {
      success: true,
      message: `✅ *Préstamo pagado!*\n\n💸 Pagaste: $${loan.totalToRepay}\n💰 El prestamista recibió: $${loan.totalToRepay - loan.amount} en intereses\n\n¡Gracias por tu negocio!`,
    };
  }

  getActiveLoans(userJid: string): Loan[] {
    return Array.from(this.loans.values()).filter(
      l => (l.lenderJid === userJid || l.borrowerJid === userJid) && l.status === 'active',
    );
  }

  getPendingLoans(userJid: string): Loan[] {
    return Array.from(this.loans.values()).filter(
      l => l.borrowerJid === userJid && l.status === 'pending',
    );
  }

  getLoanById(loanId: string): Loan | undefined {
    return this.loans.get(loanId);
  }

  getLoansAsLender(userJid: string): Loan[] {
    return Array.from(this.loans.values()).filter(l => l.lenderJid === userJid);
  }

  formatLoanDetails(loanId: string): string | null {
    const loan = this.loans.get(loanId);
    if (!loan) return null;

    const statusEmoji = {
      pending: '⏳',
      active: '✅',
      rejected: '❌',
      paid: '💚',
      defaulted: '⚠️',
    }[loan.status];

    let msg = `📋 *Préstamo ${loan.id}*\n\n`;
    msg += `Estado: ${statusEmoji} ${loan.status.toUpperCase()}\n`;
    msg += `💰 Cantidad: $${loan.amount}\n`;
    msg += `📈 Interés: ${loan.interestRate * 100}%\n`;
    msg += `💸 Total a pagar: $${loan.totalToRepay}\n`;

    if (loan.status === 'active') {
      const daysLeft = Math.ceil((loan.dueDate - Date.now()) / (1000 * 60 * 60 * 24));
      msg += `⏰ Vence en: ${daysLeft} días\n`;
      msg += `\nUsa !prestamo pagar ${loan.id} para pagar`;
    } else if (loan.status === 'pending') {
      msg += `\nUsa !prestamo aceptar ${loan.id} o !prestamo rechazar ${loan.id}`;
    }

    return msg;
  }

  checkOverdueLoans(): Loan[] {
    const now = Date.now();
    const overdue: Loan[] = [];
    let changed = false;

    for (const loan of this.loans.values()) {
      if (loan.status === 'active' && loan.dueDate < now) {
        loan.status = 'defaulted';
        overdue.push(loan);
        changed = true;
      }
    }

    if (changed) {
      this.saveLoans();
    }

    return overdue;
  }
}

export const loanService = LoanService.getInstance();
