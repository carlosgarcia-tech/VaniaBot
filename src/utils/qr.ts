/**
 * qr.ts
 *
 * Terminal presentation for the two authentication methods: the scannable QR
 * code and the phone-number pairing code.
 *
 * This writes directly to stdout (not the logger) because AuthManager patches
 * stdout to suppress Baileys' own output, and the operator needs this block to
 * be visually clean and uninterrupted.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import qrcode from 'qrcode-terminal';
import chalk from 'chalk';

const SEPARATOR = chalk.bold.cyan('═══════════════════════════════════════════════════');

/** Renders the QR block plus step-by-step linking instructions. */
export function displayQR(qr: string): void {
  console.info('\n');
  console.info(SEPARATOR);
  console.info(chalk.bold.magenta('            SCAN THE QR CODE '));
  console.info(SEPARATOR);
  console.info(chalk.yellow('\n1. Open WhatsApp on your phone'));
  console.info(chalk.yellow('2. Tap Menu (⋮) or Settings'));
  console.info(chalk.yellow('3. Tap Linked devices'));
  console.info(chalk.yellow('4. Tap Link a device'));
  console.info(chalk.yellow('5. Scan this QR code\n'));
  qrcode.generate(qr, { small: true });
  console.info(SEPARATOR);
  console.info(chalk.gray('💡 The QR code refreshes automatically every 20 seconds'));
  console.info(SEPARATOR + '\n');
}

/**
 * Renders the pairing code block.
 * The code is grouped in fours so it can be transcribed by hand accurately.
 */
export function displayPairingCode(code: string): void {
  const formattedCode = code.match(/.{1,4}/g)?.join('-') ?? code;

  console.info('\n');
  console.info(SEPARATOR);
  console.info(chalk.bold.magenta('        🔢 PAIRING CODE 🔢'));
  console.info(SEPARATOR);
  console.info(chalk.yellow('\n1. Open WhatsApp on your phone'));
  console.info(chalk.yellow('2. Tap Menu (⋮) or Settings'));
  console.info(chalk.yellow('3. Tap Linked devices'));
  console.info(chalk.yellow('4. Tap Link with phone number'));
  console.info(chalk.yellow('5. Enter this code:\n'));
  console.info(chalk.bold.hex('#00FF00')(`              ${formattedCode}`));
  console.info('');
  console.info(chalk.yellow('   → Copy and paste exactly as shown'));
  console.info(chalk.gray('   ⚠️  The code expires in ~1-2 minutes'));
  console.info(SEPARATOR + '\n');
}

/**
 * Normalises a phone number for pairing-code requests.
 *
 * @throws If the number does not contain 10-15 digits.
 * @returns The number in `+<digits>` form.
 */
export function validatePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');

  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  const digits = cleaned.replace(/\+/g, '');

  if (digits.length < 10 || digits.length > 15) {
    throw new Error(
      `Invalid phone number: ${phone}. Must have 10-15 digits (including country code).`,
    );
  }

  return cleaned;
}
