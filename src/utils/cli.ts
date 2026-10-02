import { createInterface } from 'readline';
import chalk from 'chalk';

/**
 * Interface for tracking startup progress stages.
 */
export interface StartupProgress {
  /**
   * Begins a new stage.
   * @param stage - The stage name.
   */
  begin(stage: string): void;
  /**
   * Marks a stage as completed.
   * @param stage - The stage name.
   * @param detail - Optional detail message.
   */
  done(stage: string, detail?: string): void;
  /**
   * Marks a stage as failed.
   * @param stage - The stage name.
   * @param error - Optional error message.
   */
  fail(stage: string, error?: string): void;
  /**
   * Finalizes the progress display.
   */
  finalize(): void;
}

const FRAMES_VANIA = [
  chalk.hex('#FF69B4')(`
        VANIABOT v1.0
       ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈
`),
  chalk.hex('#FF1493')(`
    VANIABOT READY!
    ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈
      System Operational!
`),
];

const LOADING_FRAMES = [
  '[Initializing Vania-Core...]',
  '[Syncing intelligent modules...]',
  '[Activating adaptive neural network...]',
  '[Processing data flows...]',
  '[Calibrating artificial intelligence...]',
  '[Stabilizing autonomous system...]',
  '[VANIABOT READY TO OPERATE.]',
];

async function wait(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

async function playFrames(frames: string[], durationMs: number): Promise<void> {
  const delay = Math.floor(durationMs / frames.length);
  for (const frame of frames) {
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

/**
 * Displays the VaniaBot startup banner with animation.
 *
 * @returns A promise that resolves when the animation completes.
 */
export async function mostrarBannerVania(): Promise<void> {
  console.clear();
  console.info(chalk.bold.magentaBright('\n⟦ ✦ ACCESS GRANTED | VANIA-BOT V.1 ✦ ⟧'));
  console.info(chalk.gray('✦ Channeling system access...'));

  await wait(400);
  await playFrames(FRAMES_VANIA, 1500);
  await playLoadingBar();

  console.info(chalk.hex('#FF1493')('VANIA-BOT'));
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
║              ${chalk.cyan('Advanced WhatsApp Bot v2.0')}                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
        [ ACCESS GRANTED ]
  `),
  );

  console.info(chalk.bold.hex('#FF1493')('\n✦═════════════════════════════════✦'));
  console.info(
    chalk.bold.white('    SYSTEM CREATED BY: ') + chalk.bold.hex('#FFD700')('Carlos G'),
  );
  console.info(chalk.bold.hex('#FF1493')('✦═════════════════════════════════✦\n'));

  await wait(400);
}

/**
 * Prompts the user to select an authentication method.
 *
 * @returns A promise that resolves to the selected auth mode ('qr' or 'code').
 */
export async function seleccionarMetodoAuth(): Promise<'qr' | 'code'> {
  return new Promise(resolve => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.info(chalk.bold.cyan('\nSelect authentication method:\n'));
    console.info(
      chalk.white('  1) ') +
        chalk.bold.green('QR Code') +
        chalk.gray(' (Scan with WhatsApp)'),
    );
    console.info(
      chalk.white('  2) ') +
        chalk.bold.yellow('Pairing Code') +
        chalk.gray(' (Link phone number)'),
    );

    rl.question(chalk.yellow('\nSelect an option (1 or 2): '), answer => {
      rl.close();
      const option = answer.trim();

      if (option === '1') {
        console.info(chalk.green('\nSelected: ') + chalk.bold('QR Code'));
        resolve('qr');
      } else if (option === '2') {
        console.info(
          chalk.green('\nSelected: ') + chalk.bold('Pairing Code'),
        );
        resolve('code');
      } else {
        console.info(
          chalk.red('\nInvalid option. ') + chalk.yellow('Using QR Code by default.'),
        );
        resolve('qr');
      }
    });
  });
}

/**
 * Creates a startup progress tracker for Docker mode.
 *
 * @returns A StartupProgress instance.
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
    ║   ╚██╗ ██╔╝██╔══██║██║╚██╗██║██║██║  ██║
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
        console.info(chalk.bold.magentaBright('\n  VaniaBot — Initializing\n'));
      }
      stageTimes[stage] = Date.now();
      total++;
      process.stdout.write(chalk.cyan(`  ${stage.padEnd(22)} `) + chalk.yellow('...  '));
    },

    done(stage: string, detail?: string): void {
      const elapsed = ((Date.now() - (stageTimes[stage] ?? overallStart)) / 1000).toFixed(1);
      completed++;
      const line =
        chalk.cyan(`  ${stage.padEnd(22)} `) +
        chalk.green('✓') +
        chalk.gray(`  (${elapsed}s)`) +
        (detail ? chalk.gray(`  ${detail}`) : '');
      console.info(line);
    },

    fail(stage: string, error?: string): void {
      const elapsed = ((Date.now() - (stageTimes[stage] ?? overallStart)) / 1000).toFixed(1);
      const line =
        chalk.cyan(`  ${stage.padEnd(22)} `) +
        chalk.red('✗') +
        chalk.gray(`  (${elapsed}s)`) +
        (error ? chalk.red(`  ${error}`) : '');
      console.info(line);
    },

    finalize(): void {
      const totalTime = ((Date.now() - overallStart) / 1000).toFixed(1);

      console.info(
        chalk.magentaBright(`\n  ─── ${completed}/${total} stages · ${totalTime}s ───\n`),
      );

      printBanner();

      console.info(chalk.bold.hex('#FF69B4')('      VANIABOT READY TO OPERATE\n'));
    },
  };
}

/**
 * Displays the help message with available commands.
 */
export function mostrarAyuda(): void {
  const c = chalk.bold.cyan;
  const w = chalk.bold.white;
  const cy = chalk.cyan;
  const g = chalk.gray;

  console.info(c('\n╔═══════════════════════════════════════════╗'));
  console.info(c('║') + '    VANIABOT - AVAILABLE COMMANDS    ' + c('║'));
  console.info(c('╚═══════════════════════════════════════════╝\n'));

  console.info(w('Startup:'));
  console.info(cy('  npm start') + g('        → Interactive menu'));
  console.info(cy('  npm start qr') + g('     → Use QR code'));
  console.info(cy('  npm start code') + g('   → Use pairing code'));

  console.info(w('\nDevelopment:'));
  console.info(cy('  npm run dev') + g('      → Development mode (watch)'));
  console.info(cy('  npm run build') + g('    → Compile TypeScript'));
  console.info(cy('  npm run lint') + g('     → Lint code'));

  console.info(w('\nMaintenance:'));
  console.info(cy('  npm run clean') + g('    → Clean session and files'));
  console.info();
}