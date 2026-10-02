/**
 * cli.ts
 *
 * Terminal presentation for startup: animated banner, authentication method
 * prompt, staged progress reporting and the help screen.
 *
 * The ASCII art, colours and emoji in this file are the actual product rather
 * than decoration in comments — they are what the operator sees on startup. They
 * are intentionally left exactly as they are.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { createInterface } from 'readline';
import chalk from 'chalk';

/** Reporter for staged startup progress, used by index.ts. */
export interface StartupProgress {
  /** Marks a stage as started and prints its spinner line. */
  begin(stage: string): void;
  /** Marks a stage as finished, printing the elapsed time. */
  done(stage: string, detail?: string): void;
  /** Marks a stage as failed, printing the elapsed time and error. */
  fail(stage: string, error?: string): void;
  /** Prints the summary line and closing banner. */
  finalize(): void;
}

/** Full-screen animation frames shown during boot. */
const FRAMES_VANIA = [
  chalk.hex('#FF69B4')(`
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢀⣀⣤⣴⣶⣶⣶⣶⣶⣤⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⢀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⡀⠀⠀⠀⠀⠀⠀
⠀⢠⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡀⠀⠀⠀⠀⠀
⠀⣾⣿⣿⣿⡿⠟⠛⠛⠛⠛⠛⠻⢿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀
⢠⣿⣿⡿⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢿⣿⣿⣿⡆⠀⠀⠀⠀
⢸⣿⣿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⡇⠀⠀⠀⠀
⢸⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⡇⠀⠀⠀⠀
⢸⣿⣿⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⣿⣿⡇⠀⠀⠀⠀
⠸⣿⣿⣧⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣾⣿⣿⡿⠀⠀⠀⠀⠀
⠀⢻⣿⣿⣿⣦⣄⣀⣀⣀⣀⣀⣠⣴⣿⣿⣿⡟⠀⠀⠀⠀⠀⠀
⠀⠀⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠈⠛⠿⣿⣿⣿⣿⣿⣿⣿⠿⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀

        VANIABOT v1.0
       ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈
`),
  chalk.hex('#FF1493')(`
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⣀⣤⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣤⣀⠀⠀⠀⠀⠀⠀⠀
⠀⢀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡀⠀⠀⠀⠀⠀
⠀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀
⢀⣿⣿⣿⡿⠛⠋⠉⠉⠉⠉⠉⠛⠻⢿⣿⣿⣿⣿⡀⠀⠀⠀⠀
⢸⣿⣿⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣿⣿⣿⡇⠀⠀⠀⠀
⢸⣿⣿⡇⠀⠀⠀⢀⣀⣀⣀⣀⡀⠀⠀⠀⣿⣿⣿⡇⠀⠀⠀⠀
⢸⣿⣿⣇⠀⢀⣴⣿⣿⣿⣿⣿⣿⣦⡀⠀⣿⣿⣿⡇⠀⠀⠀⠀
⠸⣿⣿⣿⡄⢸⣿⣿⣿⣿⣿⣿⣿⣿⡇⢠⣿⣿⣿⠇⠀⠀⠀⠀
⠀⢻⣿⣿⣿⡄⠻⣿⣿⣿⣿⣿⣿⠟⢠⣿⣿⣿⡟⠀⠀⠀⠀⠀
⠀⠀⠻⣿⣿⣿⣦⡈⠛⠿⠿⠛⢁⣴⣿⣿⣿⠟⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠈⠛⢿⣿⣿⣷⣶⣶⣾⣿⣿⡿⠛⠁⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠈⠉⠛⠛⠛⠛⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀

    🦋💖 VANIABOT READY! 💖🦋
    ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈
      ¡Sistema Operativo!
`),
];

/** Single-line "boot progress" messages printed beneath the banner. */
const LOADING_FRAMES = [
  '[🦋] Inicializando Vania-Core...',
  '[✨] Sincronizando módulos inteligentes...',
  '[🌸] Activando red neuronal adaptativa...',
  '[💫] Procesando flujos de datos...',
  '[🧠] Calibrando inteligencia artificial...',
  '[⚙️] Estabilizando sistema autónomo...',
  '[✅] VANIABOT LISTA PARA OPERAR.',
];

async function wait(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

/** Clears the screen and prints each frame in turn, evenly spaced over `durationMs`. */
async function playFrames(frames: string[], durationMs: number): Promise<void> {
  const delay = Math.floor(durationMs / frames.length);
  for (const frame of frames) {
    // eslint-disable-next-line no-console
    console.clear();
    console.info(frame);
    await wait(delay);
  }
}

/**
 * In-place status line that overwrites itself on each tick (via \r).
 * Note this writes to stdout directly rather than the logger.
 */
async function playLoadingBar(): Promise<void> {
  for (const frame of LOADING_FRAMES) {
    process.stdout.write('\r' + chalk.magentaBright(frame));
    await wait(350);
  }
  console.info('\n');
}

/** Plays the full startup animation and prints the product banner. */
export async function mostrarBannerVania(): Promise<void> {
  // eslint-disable-next-line no-console
  console.clear();
  console.info(chalk.bold.magentaBright('\n⟦ ✦ ACCESO CONCEDIDO | VANIA-BOT V.1 ✦ ⟧'));
  console.info(chalk.gray('✦ 𝘾𝙖𝙣𝙖𝙡𝙞𝙯𝙖𝙣𝙙𝙤 𝙖𝙘𝙘𝙚𝙨𝙤 𝙖𝙡 𝙨𝙞𝙨𝙩𝙚𝙢𝙖...'));

  await wait(400);
  await playFrames(FRAMES_VANIA, 1500);
  await playLoadingBar();

  console.info(chalk.hex('#FF1493')('☰✦☰═☰  𝙑𝘼𝙉𝙄𝘼-𝘽𝙊𝙏  ☰═☰✦☰'));
  console.info(
    chalk.bold.hex('#FF69B4')(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██╗   ██╗ █████╗ ███╗   ██╗██╗ █████╗     ██████╗       ║
║   ██║   ██║██╔══██╗████╗  ██║██║██╔══██╗    ██╔══██╗      ║
║   ██║   ██║███████║██╔██╗ ██║██║███████║    ██████╔╝      ║
║   ╚██╗ ██╔╝██╔══██║██║╚██╗██║██║██╔══██║    ██╔══██╗      ║
║    ╚████╔╝ ██║  ██║██║ ╚████║██║██║  ██║    ██████╔╝      ║
║     ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝    ╚═════╝       ║
║                                                           ║
║              ${chalk.cyan('WhatsApp Bot Avanzado v2.0')}                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
        [ ACCESO CONCEDIDO ]
  `),
  );

  console.info(chalk.bold.hex('#FF1493')('\n✦═════════════════════════════════✦'));
  console.info(
    chalk.bold.white('    SISTEMA CREADO POR: ') + chalk.bold.hex('#FFD700')('Carlos G'),
  );
  console.info(chalk.bold.hex('#FF1493')('✦═════════════════════════════════✦\n'));

  await wait(400);
}

/**
 * Interactively asks which authentication method to use.
 * Falls back to QR when the input is not 1 or 2, so start-up never blocks on a
 * bad answer.
 */
export async function seleccionarMetodoAuth(): Promise<'qr' | 'code'> {
  return new Promise(resolve => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.info(chalk.bold.cyan('\nSelecciona el método de autenticación:\n'));
    console.info(
      chalk.white('  1) 📱 ') +
        chalk.bold.green('Código QR') +
        chalk.gray(' (Escanear con WhatsApp)'),
    );
    console.info(
      chalk.white('  2) 🔢 ') +
        chalk.bold.yellow('Código de Pareamiento') +
        chalk.gray(' (Vincular número)'),
    );

    rl.question(chalk.yellow('\n➤ Selecciona una opción (1 o 2): '), answer => {
      rl.close();
      const option = answer.trim();

      if (option === '1') {
        console.info(chalk.green('\n✓ Método seleccionado: ') + chalk.bold('Código QR'));
        resolve('qr');
      } else if (option === '2') {
        console.info(
          chalk.green('\n✓ Método seleccionado: ') + chalk.bold('Código de Pareamiento'),
        );
        resolve('code');
      } else {
        console.info(
          chalk.red('\n❌ Opción inválida. ') + chalk.yellow('Usando Código QR por defecto.'),
        );
        resolve('qr');
      }
    });
  });
}

/**
 * Builds the staged progress reporter used during boot.
 *
 * Each `begin`/`done`/`fail` pair prints a line with the elapsed time for that
 * stage; `finalize` prints the total. Times are recorded per stage so a slow
 * dependency is obvious rather than being hidden inside the overall total.
 */
export function createStartupProgress(): StartupProgress {
  const overallStart = Date.now();
  const stageTimes: Record<string, number> = {};
  let completed = 0;
  let total = 0;
  let started = false;

  function printBanner(): void {
    console.info(
      chalk.hex('#FF1493')(`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║   ██╗   ██╗ █████╗ ███╗   ██╗██╗ █████╗
    ║   ██║   ██║██╔══██╗████╗  ██║██║██╔══██╗
    ║   ██║   ██║███████║██╔██╗ ██║██║███████║
    ║   ╚██╗ ██╔╝██╔══██║██║╚██╗██║██║██╔══██║
    ║    ╚████╔╝ ██║  ██║██║ ╚████║██║██║  ██║
    ║     ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝
    ║                                       ║
    ╚═══════════════════════════════════════╝
      `),
    );
  }

  return {
    /** Prints the header on the first call, then the stage's start line. */
    begin(stage: string): void {
      if (!started) {
        started = true;
        console.info(chalk.bold.magentaBright('\n  🦋  VaniaBot — Inicializando  🦋\n'));
      }
      stageTimes[stage] = Date.now();
      total++;
      process.stdout.write(chalk.cyan(`  ⚙️  ${stage.padEnd(22)} `) + chalk.yellow('⋯  '));
    },

    /** Completes a started stage, reporting its duration. */
    done(stage: string, detail?: string): void {
      const elapsed = ((Date.now() - (stageTimes[stage] ?? overallStart)) / 1000).toFixed(1);
      completed++;
      const line =
        chalk.cyan(`  ⚙️  ${stage.padEnd(22)} `) +
        chalk.green('✅') +
        chalk.gray(`  (${elapsed}s)`) +
        (detail ? chalk.gray(`  ${detail}`) : '');
      console.info(line);
    },

    /** Fails a started stage, reporting its duration and the error text. */
    fail(stage: string, error?: string): void {
      const elapsed = ((Date.now() - (stageTimes[stage] ?? overallStart)) / 1000).toFixed(1);
      const line =
        chalk.cyan(`  ⚙️  ${stage.padEnd(22)} `) +
        chalk.red('❌') +
        chalk.gray(`  (${elapsed}s)`) +
        (error ? chalk.red(`  ${error}`) : '');
      console.info(line);
    },

    /** Prints the stage summary and the closing banner. */
    finalize(): void {
      const totalTime = ((Date.now() - overallStart) / 1000).toFixed(1);

      console.info(
        chalk.magentaBright(`\n  ─── ${completed}/${total} etapas · ${totalTime}s ───\n`),
      );

      printBanner();

      console.info(chalk.bold.hex('#FF69B4')('      🦋  VANIABOT LISTA PARA OPERAR  🦋\n'));
    },
  };
}

/** Prints the available npm scripts, grouped by workflow. */
export function mostrarAyuda(): void {
  const c = chalk.bold.cyan;
  const w = chalk.bold.white;
  const cy = chalk.cyan;
  const g = chalk.gray;

  console.info(c('\n╔═══════════════════════════════════════════╗'));
  console.info(c('║') + '    VANIABOT - COMANDOS DISPONIBLES    ' + c('║'));
  console.info(c('╚═══════════════════════════════════════════╝\n'));

  console.info(w('Inicio:'));
  console.info(cy('  npm start') + g('        → Menú interactivo'));
  console.info(cy('  npm start qr') + g('     → Usar código QR'));
  console.info(cy('  npm start code') + g('   → Usar código de pareamiento'));

  console.info(w('\nDesarrollo:'));
  console.info(cy('  npm run dev') + g('      → Modo desarrollo (watch)'));
  console.info(cy('  npm run build') + g('    → Compilar TypeScript'));
  console.info(cy('  npm run lint') + g('     → Verificar código'));

  console.info(w('\nMantenimiento:'));
  console.info(cy('  npm run clean') + g('    → Limpiar sesión y archivos'));
  console.info();
}
