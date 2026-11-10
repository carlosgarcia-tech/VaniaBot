/**
 * cli.ts
 *
 * Terminal presentation for startup: animated banner, authentication method
 * prompt, staged progress reporting and the help screen.
 *
 * The ASCII art, colours and emoji in this file are the actual product rather
 * than decoration in comments — they are what the operator sees on startup.
 * The look is deep-space / orbit themed; every colour comes from PALETTE below,
 * so re-theming means editing that one object.
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

/** Orbit colour palette. Change a value here and it changes everywhere in the CLI. */
const PALETTE = {
  /** Indigo: main banner, titles and the first boot frame. */
  primary: '#818CF8',
  /** Sky blue: rules, the sub-banner and the closing line. */
  secondary: '#38BDF8',
  /** Cyan: the "ready" frame, loading bar and stage lines. */
  glow: '#22D3EE',
  /** Star gold: pending markers and the author credit. */
  star: '#FACC15',
} as const;

/** Ready-to-use chalk painters for {@link PALETTE}. */
const ink = {
  primary: chalk.hex(PALETTE.primary),
  secondary: chalk.hex(PALETTE.secondary),
  glow: chalk.hex(PALETTE.glow),
  star: chalk.hex(PALETTE.star),
};

/** Horizontal rule drawn as an orbit: a ring at each end of a line. */
const ORBIT_RULE = '◌' + '─'.repeat(33) + '◌';

/**
 * ORBIT logotype, one array item per line.
 *
 * Written inside String.raw so the art reads in the source exactly as it looks
 * on screen, with no "\\" escaping. Keep it that way: don't add a trailing
 * backslash on the last line (it would escape the closing backtick) and don't
 * use backticks or "${" in the art.
 */
const ORBIT_LOGO = String.raw`
 ________  ________  ________  ___  _________
|\   __  \|\   __  \|\   __  \|\  \|\___   ___\
\ \  \|\  \ \  \|\  \ \  \|\ /\ \  \|___ \  \_|
 \ \  \\\  \ \   _  _\ \   __  \ \  \   \ \  \
  \ \  \\\  \ \  \\  \\ \  \|\  \ \  \   \ \  \
   \ \_______\ \__\\ _\\ \_______\ \__\   \ \__\
    \|_______|\|__|\|__|\|_______|\|__|    \|__|
`
  .split('\n')
  .slice(1, -1);

/** Width of the widest logo line; every line is padded to it so the frame stays straight. */
const ORBIT_LOGO_WIDTH = Math.max(...ORBIT_LOGO.map(line => line.length));

/** Horizontal margin between the logo and the frame on each side. */
const BOX_PADDING = 3;

/** Total width of a frame drawn around the logo, borders included. */
const ORBIT_BOX_WIDTH = ORBIT_LOGO_WIDTH + BOX_PADDING * 2 + 2;

/** One row inside a frame: plain text (used for measuring) and an optional style. */
interface BoxRow {
  text: string;
  style?: (text: string) => string;
}

/** The logo as frame rows, padded to a common width so they stay aligned when centred. */
function logoRows(): BoxRow[] {
  return ORBIT_LOGO.map(line => ({ text: line.padEnd(ORBIT_LOGO_WIDTH) }));
}

/**
 * Draws a double-line frame around `rows`, centring each one.
 *
 * The width comes from the plain text, never from the styled string, so chalk's
 * ANSI codes cannot push the right border out of line. Rows without a style
 * use the frame colour.
 */
function drawBox(rows: BoxRow[], frame: (text: string) => string): string {
  const inner = Math.max(...rows.map(row => row.text.length)) + BOX_PADDING * 2;
  const side = frame('║');

  const body = rows.map(({ text, style = frame }) => {
    const left = Math.floor((inner - text.length) / 2);
    const right = inner - text.length - left;
    return side + ' '.repeat(left) + style(text) + ' '.repeat(right) + side;
  });

  return [frame('╔' + '═'.repeat(inner) + '╗'), ...body, frame('╚' + '═'.repeat(inner) + '╝')].join(
    '\n',
  );
}

/** Indents `text` so it is centred under a frame drawn by {@link drawBox}. */
function centerUnderBox(text: string): string {
  return ' '.repeat(Math.max(0, Math.floor((ORBIT_BOX_WIDTH - text.length) / 2))) + text;
}

/** Full-screen animation frames shown during boot. */
const FRAMES_ORBIT = [
  ink.primary(`
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

        ORBITBOT v1.0
       ◌───────◯───────◌
`),
  ink.glow(`
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

    🚀✨ ORBITBOT READY! ✨🚀
    ◌─────────◯─────────◌
      System Online!
`),
];

/** Single-line "boot progress" messages printed beneath the banner. */
const LOADING_FRAMES = [
  '[🪐] Initializing Orbit-Core...',
  '[🛰️] Syncing smart modules...',
  '[🌌] Activating adaptive neural network...',
  '[☄️] Processing data flows...',
  '[🔭] Calibrating artificial intelligence...',
  '[🌍] Stabilizing autonomous system...',
  '[🚀] ORBITBOT OPERATIONAL.',
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
    process.stdout.write('\r' + ink.glow(frame));
    await wait(350);
  }
  console.info('\n');
}

/** Plays the full startup animation and prints the product banner. */
export async function displayOrbitBanner(): Promise<void> {
  // eslint-disable-next-line no-console
  console.clear();
  console.info(ink.primary.bold('\n⟦ ✦ ACCESS GRANTED | ORBIT-BOT V.1 ✦ ⟧'));
  console.info(chalk.gray('✦ 𝘾𝙝𝙖𝙣𝙣𝙚𝙡𝙞𝙣𝙜 𝙨𝙮𝙨𝙩𝙚𝙢 𝙖𝙘𝙘𝙚𝙨𝙨...'));

  await wait(400);
  await playFrames(FRAMES_ORBIT, 1500);
  await playLoadingBar();

  console.info(ink.secondary('◌──◯──✦  𝙊𝙍𝘽𝙄𝙏-𝘽𝙊𝙏  ✦──◯──◌'));

  const frameInk = ink.primary.bold;
  console.info(
    '\n' +
      drawBox(
        [
          { text: '' },
          ...logoRows(),
          { text: '' },
          { text: 'Advanced WhatsApp Bot v2.0', style: ink.glow },
          { text: '' },
        ],
        frameInk,
      ),
  );
  console.info(frameInk(centerUnderBox('[ ACCESS GRANTED ]')) + '\n');

  console.info(ink.secondary.bold('\n' + ORBIT_RULE));
  console.info(chalk.bold.white('    SYSTEM CREATED BY: ') + ink.star.bold('Carlos G'));
  console.info(ink.secondary.bold(ORBIT_RULE + '\n'));

  await wait(400);
}

/**
 * Interactively asks which authentication method to use.
 * Falls back to QR when the input is not 1 or 2, so start-up never blocks on a
 * bad answer.
 */
export async function selectAuthMethod(): Promise<'qr' | 'code'> {
  return new Promise(resolve => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.info(chalk.bold.cyan('\nSelect authentication method:\n'));
    console.info(
      chalk.white('  1) 📱 ') + chalk.bold.green('QR code') + chalk.gray(' (Scan with WhatsApp)'),
    );
    console.info(
      chalk.white('  2) 🔢 ') + chalk.bold.yellow('Pairing code') + chalk.gray(' (Link number)'),
    );

    rl.question(chalk.yellow('\n➤ Select an option (1 or 2): '), answer => {
      rl.close();
      const option = answer.trim();

      if (option === '1') {
        console.info(chalk.green('\n✓ Selected method: ') + chalk.bold('QR code'));
        resolve('qr');
      } else if (option === '2') {
        console.info(chalk.green('\n✓ Selected method: ') + chalk.bold('Pairing code'));
        resolve('code');
      } else {
        console.info(
          chalk.red('\n❌ Invalid option. ') + chalk.yellow('Using QR code by default.'),
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
    console.info('\n' + drawBox([{ text: '' }, ...logoRows(), { text: '' }], ink.primary) + '\n');
  }

  return {
    /** Prints the header on the first call, then the stage's start line. */
    begin(stage: string): void {
      if (!started) {
        started = true;
        console.info(ink.primary.bold('\n  🪐  OrbitBot — Initializing  🪐\n'));
      }
      stageTimes[stage] = Date.now();
      total++;
      process.stdout.write(ink.glow(`  🪐  ${stage.padEnd(22)} `) + ink.star('⋯  '));
    },

    /** Completes a started stage, reporting its duration. */
    done(stage: string, detail?: string): void {
      const elapsed = ((Date.now() - (stageTimes[stage] ?? overallStart)) / 1000).toFixed(1);
      completed++;
      const line =
        ink.glow(`  🪐  ${stage.padEnd(22)} `) +
        chalk.green('✅') +
        chalk.gray(`  (${elapsed}s)`) +
        (detail ? chalk.gray(`  ${detail}`) : '');
      console.info(line);
    },

    /** Fails a started stage, reporting its duration and the error text. */
    fail(stage: string, error?: string): void {
      const elapsed = ((Date.now() - (stageTimes[stage] ?? overallStart)) / 1000).toFixed(1);
      const line =
        ink.glow(`  🪐  ${stage.padEnd(22)} `) +
        chalk.red('❌') +
        chalk.gray(`  (${elapsed}s)`) +
        (error ? chalk.red(`  ${error}`) : '');
      console.info(line);
    },

    /** Prints the stage summary and the closing banner. */
    finalize(): void {
      const totalTime = ((Date.now() - overallStart) / 1000).toFixed(1);

      console.info(ink.primary(`\n  ─── ${completed}/${total} stages · ${totalTime}s ───\n`));

      printBanner();

      console.info(ink.secondary.bold('      🚀  ORBITBOT OPERATIONAL  🚀\n'));
    },
  };
}

/** Prints the available npm scripts, grouped by workflow. */
export function showMenuHelp(): void {
  const c = chalk.bold.cyan;
  const w = chalk.bold.white;
  const cy = chalk.cyan;
  const g = chalk.gray;

  console.info(c('\n╔═══════════════════════════════════════════╗'));
  console.info(c('║') + '    ORBITBOT - AVAILABLE COMMANDS    ' + c('║'));
  console.info(c('╚═══════════════════════════════════════════╝\n'));

  console.info(w('Start:'));
  console.info(cy('  npm start') + g('        → Interactive menu'));
  console.info(cy('  npm start qr') + g('     → Use QR code'));
  console.info(cy('  npm start code') + g('   → Use pairing code'));

  console.info(w('\nDevelopment:'));
  console.info(cy('  npm run dev') + g('      → Development mode (watch)'));
  console.info(cy('  npm run build') + g('    → Compile TypeScript'));
  console.info(cy('  npm run lint') + g('     → Run linter'));

  console.info(w('\nMaintenance:'));
  console.info(cy('  npm run clean') + g('    → Clean session and files'));
  console.info();
}
