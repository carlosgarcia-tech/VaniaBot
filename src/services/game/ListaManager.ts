import type { WASocket, AnyMessageContent } from 'baileys';
import { logger, logError } from '@/utils/logger.js';
import { persistenceService } from '@/services/system/PersistenceService.js';

export type ListaTipo =
  'clk' | 'vv2' | 'cuadrilatero' | 'trilatero' | 'hexagonal' | 'ascenso' | 'scrim';

interface Jugador {
  jid: string;
  nombre: string;
}

interface Escuadra {
  jugadores: Jugador[];
  capacidad: number;
}

interface Lista {
  tipo: ListaTipo;
  chatJid: string;
  messageId: string;
  horaTexto: string;
  horaMex: string;
  horaCol: string;
  liga?: string;
  color?: string;
  escuadras: Escuadra[];
  suplentes: Jugador[];
  maxSuplentes: number;
  creadoEn: number;
  activa: boolean;
}

const DEFAULT_LISTA_TTL_MS = 6 * 60 * 60 * 1000;

function parsearHora(horaTexto: string): { mex: string; col: string } | null {
  const match = horaTexto
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);

  if (!match) return null;

  let horas = parseInt(match[1]);
  const minutos = parseInt(match[2] ?? '0');
  const meridiem = match[3];

  if (meridiem === 'pm' && horas !== 12) horas += 12;
  if (meridiem === 'am' && horas === 12) horas = 0;

  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  const to12Hour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${pad(minutos)} ${period}`;
  };

  const mexH = horas;
  const colH = (horas + 1) % 24;

  return {
    mex: to12Hour(mexH),
    col: to12Hour(colH),
  };
}

function crearEscuadras(tipo: ListaTipo): Escuadra[] {
  const crearEscuadra = (cap: number): Escuadra => ({
    jugadores: [],
    capacidad: cap,
  });

  switch (tipo) {
    case 'clk':
      return [crearEscuadra(4)];
    case 'vv2':
      return [crearEscuadra(6)];
    case 'cuadrilatero':
      return [crearEscuadra(4), crearEscuadra(4), crearEscuadra(4), crearEscuadra(4)];
    case 'trilatero':
      return [crearEscuadra(4), crearEscuadra(4), crearEscuadra(4), crearEscuadra(4)];
    case 'hexagonal':
      return [crearEscuadra(4), crearEscuadra(4)];
    case 'ascenso':
    case 'scrim':
      return [crearEscuadra(4)];
    default:
      return [crearEscuadra(4)];
  }
}

function nombreTipo(tipo: ListaTipo, liga?: string, color?: string): string {
  const base: Record<ListaTipo, string> = {
    clk: liga ? 'Liga CLK' : 'CLK',
    vv2: 'VV2',
    cuadrilatero: 'Cuadrilátero',
    trilatero: 'Trilátero',
    hexagonal: 'Hexagonal',
    ascenso: 'Ascenso',
    scrim: 'Scrim',
  };

  let nombre = base[tipo];
  if ((tipo === 'cuadrilatero' || tipo === 'trilatero' || tipo === 'hexagonal') && color) {
    nombre += ` ${color}`;
  }
  return nombre;
}

function renderizarLista(lista: Lista): string {
  const modo = nombreTipo(lista.tipo, lista.liga, lista.color);
  const lineas: string[] = [];

  lineas.push(`_*${modo}*_`);
  if (lista.liga) lineas.push(`    _*Liga: ${lista.liga}*_`);
  if (
    lista.color &&
    (lista.tipo === 'cuadrilatero' || lista.tipo === 'trilatero' || lista.tipo === 'hexagonal')
  ) {
    lineas.push(`    _*COLOR: ${lista.color}*_`);
  }

  lineas.push('');
  lineas.push(`    HORARIO`);
  lineas.push(`    🇲🇽 MEX : ${lista.horaMex}`);
  lineas.push(`    🇨🇴 COL : ${lista.horaCol}`);
  lineas.push('');
  lineas.push(`    ¬ JUGADORES PRESENTES`);

  const tieneVariasEscuadras = lista.escuadras.length > 1;

  for (let i = 0; i < lista.escuadras.length; i++) {
    const escuadra = lista.escuadras[i];

    if (tieneVariasEscuadras) {
      lineas.push(`          ESCUADRA ${i + 1}`);
    } else {
      lineas.push(`          ESCUADRA`);
    }

    for (let j = 0; j < escuadra.capacidad; j++) {
      const jugador = escuadra.jugadores[j];
      const icono = j === 0 ? '👑' : '🥷🏻';
      const nombre = jugador ? `@${jugador.jid.split('@')[0]}` : '';
      lineas.push(`    ${icono} ┇ ${nombre}`);
    }

    if (tieneVariasEscuadras && i < lista.escuadras.length - 1) {
      lineas.push('');
    }
  }

  lineas.push('');
  lineas.push(`    ᅠʚ SUPLENTE:`);
  for (let i = 0; i < lista.maxSuplentes; i++) {
    const suplente = lista.suplentes[i];
    const nombre = suplente ? `@${suplente.jid.split('@')[0]}` : '';
    lineas.push(`    🥷🏻 ┇ ${nombre}`);
  }

  return lineas.join('\n');
}

function getMenciones(lista: Lista): string[] {
  const jids: string[] = [];
  for (const escuadra of lista.escuadras) {
    for (const j of escuadra.jugadores) jids.push(j.jid);
  }
  for (const s of lista.suplentes) jids.push(s.jid);
  return jids;
}

function estaEnLista(lista: Lista, jid: string): boolean {
  for (const e of lista.escuadras) {
    if (e.jugadores.some(j => j.jid === jid)) return true;
  }
  return lista.suplentes.some(s => s.jid === jid);
}

function agregarJugador(lista: Lista, jid: string, nombre: string): boolean {
  if (estaEnLista(lista, jid)) {
    logger.debug(`[LISTA] ${jid} ya está en la lista, ignorando`);
    return false;
  }

  for (const escuadra of lista.escuadras) {
    if (escuadra.jugadores.length < escuadra.capacidad) {
      escuadra.jugadores.push({ jid, nombre });
      logger.debug(`[LISTA] ${jid} (${nombre}) agregado a escuadra`);
      return true;
    }
  }

  if (lista.suplentes.length < lista.maxSuplentes) {
    lista.suplentes.push({ jid, nombre });
    logger.debug(`[LISTA] ${jid} (${nombre}) agregado como suplente`);
    return true;
  }

  logger.debug(`[LISTA] Lista llena, no se pudo agregar ${jid}`);
  return false;
}

function removerJugador(lista: Lista, jid: string): boolean {
  for (const escuadra of lista.escuadras) {
    const idx = escuadra.jugadores.findIndex(j => j.jid === jid);
    if (idx !== -1) {
      escuadra.jugadores.splice(idx, 1);
      logger.debug(`[LISTA] ${jid} removido de escuadra`);
      if (lista.suplentes.length > 0) {
        const promovido = lista.suplentes[0];
        lista.suplentes.shift();
        escuadra.jugadores.push(promovido);
        logger.debug(`[LISTA] ${promovido.jid} promovido de suplente a escuadra`);
      }
      return true;
    }
  }

  const idxSup = lista.suplentes.findIndex(s => s.jid === jid);
  if (idxSup !== -1) {
    lista.suplentes.splice(idxSup, 1);
    logger.debug(`[LISTA] ${jid} removido de suplentes`);
    return true;
  }

  logger.debug(`[LISTA] ${jid} no encontrado en la lista para remover`);
  return false;
}

export class ListaManager {
  private listas = new Map<string, Lista>();
  private listasPorChat = new Map<string, string>();
  private cleanupInterval: NodeJS.Timeout;
  private listaTtlMs: number | null = null;

  constructor() {
    this.cleanupInterval = setInterval(
      () => {
        try {
          this.limpiarExpiradas();
        } catch (error) {
          logError('[ListaManager] Cleanup error', error);
        }
      },
      30 * 60 * 1000,
    );
    // Cleanup-only timer: must not keep the process alive on shutdown.
    this.cleanupInterval.unref();
  }

  async initialize(): Promise<void> {
    await this.loadFromPersistence();
    logger.debug(`[LISTA] ${this.listas.size} listas cargadas desde persistencia`);
  }

  private async loadFromPersistence(): Promise<void> {
    const stored = persistenceService.getAllListas();
    for (const lista of stored) {
      if (lista.activa) {
        this.listas.set(lista.messageId, lista as Lista);
      }
    }
  }

  private async syncToPersistence(lista: Lista): Promise<void> {
    await persistenceService.saveLista(
      lista.messageId,
      lista as unknown as Parameters<typeof persistenceService.saveLista>[1],
    );
  }

  private async removeFromPersistence(messageId: string): Promise<void> {
    await persistenceService.removeLista(messageId);
  }

  crearLista(params: {
    tipo: ListaTipo;
    chatJid: string;
    messageId: string;
    horaTexto?: string;
    liga?: string;
    color?: string;
  }): Lista {
    let horaMex = '00:00';
    let horaCol = '00:00';

    if (params.horaTexto) {
      const parsed = parsearHora(params.horaTexto);
      if (parsed) {
        horaMex = parsed.mex;
        horaCol = parsed.col;
      }
    }

    const lista: Lista = {
      tipo: params.tipo,
      chatJid: params.chatJid,
      messageId: params.messageId,
      horaTexto: params.horaTexto ?? '00:00',
      horaMex,
      horaCol,
      liga: params.liga,
      color: params.color,
      escuadras: crearEscuadras(params.tipo),
      suplentes: [],
      maxSuplentes: 2,
      creadoEn: Date.now(),
      activa: true,
    };

    this.listas.set(params.messageId, lista);
    this.listasPorChat.set(params.chatJid, params.messageId);
    this.syncToPersistence(lista).catch(err =>
      logError('[LISTA] Error guardando en persistencia', err),
    );
    logger.debug(
      `[LISTA] Creada: tipo=${params.tipo} messageId=${params.messageId} chatJid=${params.chatJid}`,
    );
    return lista;
  }

  getLista(messageId: string): Lista | undefined {
    let lista = this.listas.get(messageId);

    if (!lista) {
      const chatJidFromMap = this.listasPorChat.get(messageId);
      if (chatJidFromMap) {
        lista = this.listas.get(chatJidFromMap);
      }
    }

    if (!lista) {
      for (const [_msgId, lst] of this.listas.entries()) {
        if (lst.chatJid === messageId && lst.activa) {
          lista = lst;
          break;
        }
      }
    }

    logger.debug(
      `[LISTA] getLista(${messageId}) → ${lista ? `encontrada (activa=${lista.activa})` : 'NO encontrada'}`,
    );
    return lista;
  }

  getListaByChat(chatJid: string): Lista | undefined {
    const msgId = this.listasPorChat.get(chatJid);
    if (msgId) {
      const lista = this.listas.get(msgId);
      if (lista && lista.activa) return lista;
    }

    for (const lista of this.listas.values()) {
      if (lista.chatJid === chatJid && lista.activa) return lista;
    }
    return undefined;
  }

  async onReaccion(
    sock: WASocket,
    reaccion: {
      chatJid: string;
      messageId: string;
      senderJid: string;
      senderNombre: string;
      emoji: string;
    },
  ): Promise<{ success: boolean; reason?: string; listaActiva?: boolean }> {
    const lista = this.getLista(reaccion.messageId);

    if (!lista) {
      logger.debug(`[LISTA REACCION] No hay lista con ese messageId`);
      return { success: false, reason: 'no_existe', listaActiva: false };
    }

    if (!lista.activa) {
      logger.debug(`[LISTA REACCION] Lista inactiva`);
      return { success: false, reason: 'inactiva', listaActiva: false };
    }

    const eliminado = reaccion.emoji === '';

    if (eliminado) {
      const removido = removerJugador(lista, reaccion.senderJid);
      if (!removido) return { success: false, reason: 'no_en_lista', listaActiva: true };
    } else {
      const agregado = agregarJugador(lista, reaccion.senderJid, reaccion.senderNombre);
      if (!agregado) return { success: false, reason: 'lista_llena', listaActiva: true };
    }

    await this.editarMensaje(sock, lista);
    await this.syncToPersistence(lista);
    return { success: true, listaActiva: true };
  }

  async editarMensaje(sock: WASocket, lista: Lista): Promise<void> {
    try {
      const texto = renderizarLista(lista);
      const menciones = getMenciones(lista);

      try {
        const message: AnyMessageContent = {
          text: texto,
          mentions: menciones,
          edit: { id: lista.messageId, remoteJid: lista.chatJid, fromMe: true },
        };

        await sock.sendMessage(lista.chatJid, message);
      } catch (editError) {
        logger.debug(`[LISTA] Edit failed, trying delete+send: ${editError}`);

        try {
          await sock.sendMessage(lista.chatJid, {
            text: texto,
            mentions: menciones,
          });
        } catch (sendError) {
          logError('[LISTA SEND ERROR]', sendError);
        }
      }
    } catch (error) {
      logError('[LISTA EDITAR ERROR]', error);
    }
  }

  desactivarLista(messageId: string): void {
    const lista = this.listas.get(messageId);
    if (lista) {
      lista.activa = false;
      this.listasPorChat.delete(lista.chatJid);
      this.removeFromPersistence(messageId).catch(err =>
        logError('[LISTA] Error removiendo de persistencia', err),
      );
      logger.info(`[LISTA] Desactivada: ${messageId}`);
    }
  }

  private limpiarExpiradas(): void {
    const now = Date.now();
    const ttl = this.getTTL();
    for (const [id, lista] of this.listas.entries()) {
      if (now - lista.creadoEn > ttl) {
        this.listas.delete(id);
        this.listasPorChat.delete(lista.chatJid);
        this.removeFromPersistence(id).catch(err =>
          logError('[LISTA] Error removiendo expirada de persistencia', err),
        );
        logger.info(`[LISTA] Expirada y eliminada: ${id}`);
      }
    }
  }

  getTTL(): number {
    return this.listaTtlMs || DEFAULT_LISTA_TTL_MS;
  }

  setTTL(ttlHours: number): void {
    this.listaTtlMs = ttlHours * 60 * 60 * 1000;
    logger.info(`[LISTA] TTL configurado a ${ttlHours} horas`);
  }

  getDefaultTTL(): number {
    return DEFAULT_LISTA_TTL_MS;
  }

  renderizar(lista: Lista): string {
    return renderizarLista(lista);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const listaManager = new ListaManager();
