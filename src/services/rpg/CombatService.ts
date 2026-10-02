/**
 * CombatService.ts
 *
 * VaniaBot services module exposing `CombatService`, `CombatResult`, `CombatLog`, `combatService`.
 *
 * @author **Carlos G**
 */

import { mobService, type Mob } from './MobService.js';
import { itemService } from './ItemService.js';
import { serviceManager } from '../system/Servicemanager.js';

export interface CombatResult {
  won: boolean;
  playerDamage: number;
  mobDamage: number;
  xpGained: number;
  moneyGained: number;
  itemsGained: string[];
  playerCurrentHp: number;
  mobCurrentHp: number;
  turns: number;
}

export interface CombatLog {
  round: number;
  playerAttack: string;
  mobAttack: string;
  playerHp: number;
  mobHp: number;
}

export class CombatService {
  private static instance: CombatService;
  private activeCombats: Map<
    string,
    { mob: Mob; playerHp: number; turns: number; logs: CombatLog[] }
  > = new Map();

  static getInstance(): CombatService {
    if (!CombatService.instance) {
      CombatService.instance = new CombatService();
    }
    return CombatService.instance;
  }

  async startCombat(
    jid: string,
    mobIdOrName: string,
  ): Promise<{ message: string; success: boolean }> {
    const user = await serviceManager.userService.getUser(jid);
    const mob = mobService.getMobByName(mobIdOrName);

    if (!mob) {
      return { message: '❌ Mob no encontrado', success: false };
    }

    if (this.activeCombats.has(jid)) {
      return { message: '❌ Ya tienes un combate activo', success: false };
    }

    const playerStats = user.stats || { hp: 100, maxHp: 100, atk: 10, def: 5, agi: 10, luck: 5 };
    const totalStats = await itemService.getTotalStats(jid);

    const effectiveHp = totalStats.hp || playerStats.hp || 100;
    const effectiveAtk = totalStats.atk || playerStats.atk || 10;
    const effectiveDef = totalStats.def || playerStats.def || 5;
    const effectiveAgi = totalStats.agi || playerStats.agi || 10;
    const effectiveLuck = totalStats.luck || playerStats.luck || 5;

    this.activeCombats.set(jid, {
      mob,
      playerHp: effectiveHp,
      turns: 0,
      logs: [],
    });

    const playerCritChance = totalStats.critChance || 5;

    const playerDmg = this.calculateDamage(
      effectiveAtk,
      effectiveDef,
      effectiveLuck,
      playerCritChance,
    );
    const mobDmg = this.calculateDamage(mob.atk, effectiveDef, mob.level, 5);

    const playerWins = effectiveHp > mob.hp * 2;

    let result: CombatResult;

    if (playerWins) {
      const drops = mobService.getMobDrops(mob);

      for (const dropItemId of drops) {
        await itemService.addItem(jid, dropItemId);
      }

      await serviceManager.userService.addMoney(jid, mob.moneyReward);
      await serviceManager.userService.addXP(jid, mob.xpReward);

      const updatedUser = await serviceManager.userService.getUser(jid);
      const newTotalStats = await itemService.getTotalStats(jid);

      result = {
        won: true,
        playerDamage: mobDmg,
        mobDamage: playerDmg,
        xpGained: mob.xpReward,
        moneyGained: mob.moneyReward,
        itemsGained: drops,
        playerCurrentHp: newTotalStats.hp || updatedUser.stats?.hp || 100,
        mobCurrentHp: 0,
        turns: 1,
      };
    } else {
      const escaped = Math.random() < effectiveAgi / (effectiveAgi + mob.level * 2);

      if (escaped) {
        this.activeCombats.delete(jid);
        return { message: `🏃 ¡Escapaste del combate!`, success: true };
      }

      const damageTaken = Math.max(1, mobDmg - effectiveDef / 2);
      const newHp = Math.max(0, effectiveHp - damageTaken);

      await this.updatePlayerHp(jid, newHp);

      result = {
        won: false,
        playerDamage: damageTaken,
        mobDamage: playerDmg,
        xpGained: Math.floor(mob.xpReward * 0.1),
        moneyGained: Math.floor(mob.moneyReward * 0.1),
        itemsGained: [],
        playerCurrentHp: newHp,
        mobCurrentHp: mob.hp,
        turns: 1,
      };
    }

    this.activeCombats.delete(jid);

    const itemDropsText =
      result.itemsGained.length > 0 ? `\n🎁 *Drops:* ${result.itemsGained.join(', ')}` : '';

    let message = result.won
      ? `⚔️ *¡VICTORIA!*\n\n${mob.emoji} Derrotaste a *${mob.name}*\n\n`
      : `⚔️ *DERROTA*\n\n${mob.emoji} *${mob.name}* te derrotó\n\n`;

    message += `💥 Daño hecho: ${result.mobDamage}\n`;
    message += `❤️ Daño recibido: ${result.playerDamage}\n`;
    message += `✨ XP: +${result.xpGained}\n`;
    message += `💰 Dinero: +$${result.moneyGained}`;
    message += itemDropsText;

    return { message, success: true };
  }

  async attack(jid: string): Promise<{ message: string; success: boolean }> {
    const combat = this.activeCombats.get(jid);
    if (!combat) {
      return { message: '❌ No tienes un combate activo. Usa !fight [mob]', success: false };
    }

    const user = await serviceManager.userService.getUser(jid);
    const playerStats = user.stats || { hp: 100, maxHp: 100, atk: 10, def: 5, agi: 10, luck: 5 };
    const totalStats = await itemService.getTotalStats(jid);

    const effectiveAtk = totalStats.atk || playerStats.atk || 10;
    const effectiveDef = totalStats.def || playerStats.def || 5;
    const effectiveAgi = totalStats.agi || playerStats.agi || 10;
    const effectiveLuck = totalStats.luck || playerStats.luck || 5;

    const playerCritChance = totalStats.critChance || 5;
    const playerDodgeChance = totalStats.dodgeChance || 5;

    combat.turns++;

    const playerDmg = this.calculateDamage(
      effectiveAtk,
      combat.mob.def,
      effectiveLuck,
      playerCritChance,
    );
    combat.mob.hp -= playerDmg;

    if (combat.mob.hp <= 0) {
      const drops = mobService.getMobDrops(combat.mob);

      for (const dropItemId of drops) {
        await itemService.addItem(jid, dropItemId);
      }

      await serviceManager.userService.addMoney(jid, combat.mob.moneyReward);
      await serviceManager.userService.addXP(jid, combat.mob.xpReward);

      const itemDropsText = drops.length > 0 ? `\n🎁 *Drops:* ${drops.join(', ')}` : '';

      this.activeCombats.delete(jid);

      return {
        message: `⚔️ *¡VICTORIA!*\n\n${combat.mob.emoji} Derrotaste a *${combat.mob.name}*\n\n✨ XP: +${combat.mob.xpReward}\n💰 Dinero: +$${combat.mob.moneyReward}${itemDropsText}`,
        success: true,
      };
    }

    const dodgeRoll = Math.random() * 100;
    let mobDamage = 0;

    if (dodgeRoll < playerDodgeChance) {
      mobDamage = 0;
    } else {
      mobDamage = this.calculateDamage(combat.mob.atk, effectiveDef, combat.mob.level, 5);
    }

    const newPlayerHp = Math.max(0, combat.playerHp - mobDamage);
    combat.playerHp = newPlayerHp;

    if (newPlayerHp <= 0) {
      const xpReward = Math.floor(combat.mob.xpReward * 0.1);
      const moneyReward = Math.floor(combat.mob.moneyReward * 0.1);

      await serviceManager.userService.addMoney(jid, moneyReward);
      await serviceManager.userService.addXP(jid, xpReward);
      await this.updatePlayerHp(jid, 0);

      this.activeCombats.delete(jid);

      return {
        message: `⚔️ *DERROTA*\n\n${combat.mob.emoji} *${combat.mob.name}* te derrotó\n\n✨ XP: +${xpReward}\n💰 Dinero: +$${moneyReward}\n\n❤️ Usa !heal para recuperarte`,
        success: true,
      };
    }

    const escapeChance = (effectiveAgi / (effectiveAgi + combat.mob.level * 3)) * 50;

    let message = `⚔️ *Turno ${combat.turns}*\n\n`;
    message += `👊 Atacas: ${playerDmg} dmg a ${combat.mob.name}\n`;
    message += `❤️ Tu HP: ${newPlayerHp}\n`;
    message += `${combat.mob.emoji} HP ${combat.mob.name}: ${combat.mob.hp}\n`;

    if (mobDamage > 0) {
      message += `💥 Daño recibido: ${mobDamage}\n`;
    } else {
      message += `💨 ¡Esquivaste el ataque!\n`;
    }

    message += `\n🏃 Escapar: ${Math.floor(escapeChance)}%`;

    return { message, success: true };
  }

  async flee(jid: string): Promise<{ message: string; success: boolean }> {
    const combat = this.activeCombats.get(jid);
    if (!combat) {
      return { message: '❌ No tienes un combate activo', success: false };
    }

    const user = await serviceManager.userService.getUser(jid);
    const totalStats = await itemService.getTotalStats(jid);
    const effectiveAgi = totalStats.agi || user.stats?.agi || 10;

    const escapeChance = (effectiveAgi / (effectiveAgi + combat.mob.level * 3)) * 100;

    if (Math.random() * 100 < escapeChance) {
      this.activeCombats.delete(jid);
      return { message: `🏃 ¡Escapaste exitosamente!`, success: true };
    } else {
      const damage = Math.max(1, combat.mob.atk - (totalStats.def || user.stats?.def || 5));
      combat.playerHp = Math.max(0, combat.playerHp - damage);
      await this.updatePlayerHp(jid, combat.playerHp);

      if (combat.playerHp <= 0) {
        this.activeCombats.delete(jid);
        return {
          message: `⚔️ *DERROTA*\n\nNo pudiste escapar y ${combat.mob.name} te derrotó\n\n❤️ Usa !heal para recuperarte`,
          success: true,
        };
      }

      return {
        message: `❌ ¡No pudiste escapar!\n\n💥 Daño recibido: ${damage}\n❤️ Tu HP: ${combat.playerHp}`,
        success: true,
      };
    }
  }

  getCombatStatus(jid: string): { active: boolean; mob?: Mob; playerHp?: number; turns?: number } {
    const combat = this.activeCombats.get(jid);
    if (!combat) {
      return { active: false };
    }
    return {
      active: true,
      mob: combat.mob,
      playerHp: combat.playerHp,
      turns: combat.turns,
    };
  }

  private calculateDamage(atk: number, def: number, luck: number, critChance: number): number {
    const baseDamage = atk * (1 - def / (def + 100));

    const isCrit = Math.random() * 100 < critChance;
    const critMultiplier = isCrit ? 1.5 : 1;

    const variance = 0.8 + Math.random() * 0.4;
    const luckBonus = 1 + luck / 200;

    return Math.floor(baseDamage * critMultiplier * variance * luckBonus);
  }

  private async updatePlayerHp(jid: string, hp: number): Promise<void> {
    const user = await serviceManager.userService.getUser(jid);
    const stats = user.stats || {
      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      stamina: 100,
      maxStamina: 100,
      atk: 10,
      def: 5,
      str: 10,
      int: 10,
      agi: 10,
      vit: 10,
      luck: 5,
      critChance: 5,
      dodgeChance: 5,
    };

    await serviceManager.userService.updateUser(jid, {
      stats: { ...stats, hp },
    });
  }
}

export const combatService = CombatService.getInstance();
