/**
 * AudioResponseHandler.ts
 *
 * Handles automatic audio responses based on keyword triggers.
 * This handler listens for specific words/phrases and responds with audio.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @created 2026-04-04
 */

import type { WASocket, proto } from 'baileys';
import { logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

interface AudioTrigger {
  pattern: RegExp;
  audioUrl: string;
}

const AUDIO_TRIGGERS: AudioTrigger[] = [
  { pattern: /\bbuenos?\s+d[ií]as?\b/i, audioUrl: 'https://qu.ax/wLUF.mp3' },
  { pattern: /\bbuenas\s+noches\b/i, audioUrl: 'https://qu.ax/TTfs.mp3' },
  { pattern: /\b(hola|ola|hi|hello|hey)\b/i, audioUrl: 'https://qu.ax/eGdW.mp3' },
  { pattern: /\bbienvenido\b|🥳|🤗/gi, audioUrl: 'https://qu.ax/cUYg.mp3' },
  { pattern: /\bblackpink\s+in\s+your\s+area\b/i, audioUrl: 'https://qu.ax/pavq.mp3' },
  { pattern: /\bara\s+ara\b/i, audioUrl: 'https://qu.ax/PPgt.mp3' },
  { pattern: /\b(fbi|FBI|picus|PICUS)\b/i, audioUrl: 'https://qu.ax/wFbD.mp3' },
  { pattern: /\bte\s+amo\b|\bteamo\b/i, audioUrl: 'https://qu.ax/rGdn.mp3' },
  { pattern: /\b(siuuu?|siiuu+|sii+i+uuuu+)\b/i, audioUrl: 'https://qu.ax/bfC.mp3' },
  { pattern: /\buwu\b/i, audioUrl: 'https://qu.ax/hfyX.mp3' },
  { pattern: /:c/g, audioUrl: 'https://qu.ax/XMHj.mp3' },
  { pattern: /\bjoder\b/i, audioUrl: 'https://qu.ax/lSgD.mp3' },
  { pattern: /\bbruno\b/i, audioUrl: 'https://qu.ax/frSi.mp3' },
  { pattern: /\b(wtf|wataf)\b/i, audioUrl: 'https://qu.ax/aPtM.mp3' },
  { pattern: /\b(sus|among\s+us)\b/i, audioUrl: 'https://qu.ax/Mnrz.mp3' },
  { pattern: /\byamete\b/i, audioUrl: 'https://qu.ax/thgS.mp3' },
  { pattern: /\bo[n-]?nichan\b/i, audioUrl: 'https://qu.ax/sEFj.mp3' },
  { pattern: /\b(pokemon|pikachu)\b/i, audioUrl: 'https://qu.ax/kWLh.mp3' },
  { pattern: /\bpika\b/i, audioUrl: 'https://qu.ax/wbAf.mp3' },
  { pattern: /\b(feliz\s+navidad|merry\s+christmas)\b/i, audioUrl: 'https://qu.ax/XYyY.m4a' },
  { pattern: /\b(jesucristo|jesús|auronplay)\b/i, audioUrl: 'https://qu.ax/AWdx.mp3' },
  { pattern: /\bel\s+pepe\b/i, audioUrl: 'https://qu.ax/Efdb.mp3' },
  { pattern: /\bnoche\s+de\s+paz\b/i, audioUrl: 'https://qu.ax/SgrV.mp3' },
  { pattern: /\b(omg|omaiga|omaiga)\b/i, audioUrl: 'https://qu.ax/PfuN.mp3' },
  { pattern: /\b(ohayo|ojayo)\b/i, audioUrl: 'https://qu.ax/PFxn.mp3' },
  { pattern: /\b(nyapasu|nya\s+pasu)\b/i, audioUrl: 'https://qu.ax/ZgFZ.mp3' },
  { pattern: /\bniconico\b/i, audioUrl: 'https://qu.ax/YdVq.mp3' },
  { pattern: /\byoshi\b/i, audioUrl: 'https://qu.ax/ZgKT.mp3' },
  { pattern: /\bnadie\s+te\s+pregunto\b/i, audioUrl: 'https://qu.ax/MrGg.mp3' },
  { pattern: /\bh[aá]blame\b/i, audioUrl: 'https://qu.ax/uQqA.mp3' },
  { pattern: /\bra+w+r+\b/i, audioUrl: 'https://qu.ax/YnoG.mp3' },
  { pattern: /\b[oó]rale\b/i, audioUrl: 'https://qu.ax/Epen.mp3' },
  { pattern: /\bque\s+onda\b/i, audioUrl: 'https://qu.ax/YpsR.mp3' },
  { pattern: /\b(hey|hei)\b/i, audioUrl: 'https://qu.ax/AaBt.mp3' },
  { pattern: /\b(oye|🐔|chiste)\b/i, audioUrl: 'https://qu.ax/MSiQ.mp3' },
  { pattern: /\bvivan\s+(los\s+)?novios\b/i, audioUrl: 'https://qu.ax/vHX.mp3' },
  { pattern: /\bverdad\s+que\b/i, audioUrl: 'https://qu.ax/yTid.mp3' },
  { pattern: /\b(moshi\s+moshi|shinobu|mundo)\b/i, audioUrl: 'https://qu.ax/JAyd.mp3' },
  { pattern: /\bmmm+\b/i, audioUrl: 'https://qu.ax/gxFs.mp3' },
  { pattern: /\b(corte|pelea|pelear|golpe)\b/i, audioUrl: 'https://qu.ax/hRuU.mp3' },
  { pattern: /\btunometecabrasaramambiche\b/i, audioUrl: 'https://qu.ax/LAAB.mp3' },
  { pattern: /\b(me\s+voy|me\s+fui|chao|adi[oó]s)\b/i, audioUrl: 'https://qu.ax/iOky.mp3' },
  { pattern: /\bfino\s+se[ñn]ores\b/i, audioUrl: 'https://qu.ax/hapR.mp3' },
  { pattern: /\bfiesta\s+(del\s+admin|en\s+casa)\b/i, audioUrl: 'https://qu.ax/MpnG.mp3' },
  { pattern: /\bfeliz\s+cumplea[ñn]os\b/i, audioUrl: 'https://qu.ax/UtmZ.mp3' },
  { pattern: /\besto\s+va\s+(a\s+)?(ser|hacer)\s+[ée]pico\b/i, audioUrl: 'https://qu.ax/pjTx.mp3' },
  { pattern: /\b(entrada|ingresa)\b/i, audioUrl: 'https://qu.ax/UpAC.mp3' },
  { pattern: /\b(enojado|molesto)\b/i, audioUrl: 'https://qu.ax/jqTX.mp3' },
  { pattern: /\bba[ñn]ate\b/i, audioUrl: 'https://qu.ax/JsYa.mp3' },
  { pattern: /\bbueno\s+s[ií]\b/i, audioUrl: 'https://qu.ax/DqBM.mp3' },
  { pattern: /\b(cada|basado|basada)\b/i, audioUrl: 'https://qu.ax/jDAl.mp3' },
  {
    pattern: /\bdiagnosticado\s+con\s+gay\b|\bdiagnosticadocongay\b/i,
    audioUrl: 'https://qu.ax/cUl.mp3',
  },
  { pattern: /\bme\s+olvid[ée]\b/i, audioUrl: 'https://qu.ax/SbX.mp3' },
  { pattern: /\b(la\s+biblia|oremos|rezemos)\b/i, audioUrl: 'https://qu.ax/GeeA.mp3' },
  { pattern: /\b(free\s?fire)\b/i, audioUrl: 'https://qu.ax/Dwqp.mp3' },
  { pattern: /\baguanta\b/i, audioUrl: 'https://qu.ax/Qmz.mp3' },
  { pattern: /\b(es\s+viernes|viernes\s+fiesta)\b/i, audioUrl: 'https://qu.ax/LcdD.mp3' },
  { pattern: /:d/g, audioUrl: 'https://qu.ax/cxDg.mp3' },
  { pattern: /\bbanco\b/i, audioUrl: 'https://qu.ax/fwek.mp3' },
  { pattern: /\b(lloro|porqu[eé]\s+est[aá]s\s+tite)\b|😭/gi, audioUrl: 'https://qu.ax/VrjA.mp3' },
  { pattern: /\bzzz+\b|💩|👽/gi, audioUrl: 'https://qu.ax/KkSZ.mp3' },
  { pattern: /\b(god|eres\s+fuerte)\b|🤜|🤛/gi, audioUrl: 'https://qu.ax/lhzq.mp3' },
  { pattern: /\bc[áa]mbiate\s+a\s+movistar\b|\bmovistar\b/i, audioUrl: 'https://qu.ax/RxJC.mp3' },
  { pattern: /\b(el\s+t[óo]xico|toxico)\b/i, audioUrl: 'https://qu.ax/WzBd.mp3' },
  { pattern: /\btodo\s+bien\b|😇|😄/gi, audioUrl: 'https://qu.ax/EDUC.mp3' },
  { pattern: /\b(vete\s+a\s+la\s+verga|vetealavrg)\b/i, audioUrl: 'https://qu.ax/pXts.mp3' },
];

const processedMessages = new Set<string>();

export async function handleAudioResponse(
  sock: WASocket,
  message: proto.IWebMessageInfo,
): Promise<void> {
  try {
    const msgText =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      message.message?.imageMessage?.caption ||
      '';

    if (!msgText) return;

    if (!message.key?.remoteJid) return;

    const chatJid = message.key.remoteJid;
    if (!chatJid.endsWith('@g.us')) return;

    let groupSettings;
    try {
      groupSettings = await serviceManager.groupService.getGroup(chatJid);
    } catch {
      return;
    }

    if (!groupSettings.audios) return;

    if (!message.key.id) return;

    const msgId = message.key.id;
    if (processedMessages.has(msgId)) return;

    if (processedMessages.size > 1000) {
      processedMessages.clear();
    }

    for (const trigger of AUDIO_TRIGGERS) {
      if (trigger.pattern.test(msgText)) {
        processedMessages.add(msgId);

        try {
          await sock.sendPresenceUpdate('recording', chatJid);

          await sock.sendMessage(chatJid, {
            audio: { url: trigger.audioUrl },
            mimetype: 'audio/mp4',
            ptt: true,
          });
        } catch (error) {
          logError('[AudioResponse] Error sending audio:', error);
        }

        return;
      }
    }
  } catch (error) {
    logError('[AudioResponse] Error:', error);
  }
}
