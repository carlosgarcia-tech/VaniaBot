import { createInterface } from 'readline';
import chalk from 'chalk';

export interface StartupProgress {
  begin(stage: string): void;
  done(stage: string, detail?: string): void;
  fail(stage: string, error?: string): void;
  finalize(): void;
}

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

async function playFrames(frames: string[], durationMs: number): Promise<void> {
  const delay = Math.floor(durationMs / frames.length);
  for (const frame of frames) {
    // eslint-disable-next-line no-console
    console.clear();
    console.info(frame);
    await wait(delay);
  }
}

async function playLoadingBar(): Promise<void> {
  for (const frame of LOADING_FRAMES) {
    process.stdout.write('\r' + chalk.magentaBright(frame));
    await wait(350);
  }
  console.info('\n');
}

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
    begin(stage: string): void {
      if (!started) {
        started = true;
        console.info(chalk.bold.magentaBright('\n  🦋  VaniaBot — Inicializando  🦋\n'));
      }
      stageTimes[stage] = Date.now();
      total++;
      process.stdout.write(chalk.cyan(`  ⚙️  ${stage.padEnd(22)} `) + chalk.yellow('⋯  '));
    },

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

    fail(stage: string, error?: string): void {
      const elapsed = ((Date.now() - (stageTimes[stage] ?? overallStart)) / 1000).toFixed(1);
      const line =
        chalk.cyan(`  ⚙️  ${stage.padEnd(22)} `) +
        chalk.red('❌') +
        chalk.gray(`  (${elapsed}s)`) +
        (error ? chalk.red(`  ${error}`) : '');
      console.info(line);
    },

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
