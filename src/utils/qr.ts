import qrcode from 'qrcode-terminal';
import chalk from 'chalk';

const SEPARATOR = chalk.bold.cyan('═══════════════════════════════════════════════════');

/**
 * Displays a QR code in the terminal for WhatsApp authentication.
 *
 * @param qr - The QR code string from Baileys.
 */
export function displayQR(qr: string): void {
  console.info('\n');
  console.info(SEPARATOR);
  console.info(chalk.bold.magenta('            SCAN THE QR CODE '));
  console.info(SEPARATOR);
  console.info(chalk.yellow('\n1. Open WhatsApp on your phone'));
  console.info(chalk.yellow('2. Tap Menu (⋮) or Settings'));
  console.info(chalk.yellow('3. Tap Linked Devices'));
  console.info(chalk.yellow('4. Tap Link a Device'));
  console.info(chalk.yellow('5. Scan this QR code\n'));
  qrcode.generate(qr, { small: true });
  console.info(SEPARATOR);
  console.info(chalk.gray('The QR code refreshes automatically every 20 seconds'));
  console.info(SEPARATOR + '\n');
}

/**
 * Displays a pairing code in the terminal for WhatsApp authentication.
 *
 * @param code - The pairing code string from Baileys.
 */
export function displayPairingCode(code: string): void {
  const formattedCode = code.match(/.{1,4}/g)?.join('-') ?? code;

  console.info('\n');
  console.info(SEPARATOR);
  console.info(chalk.bold.magenta('        PAIRING CODE'));
  console.info(SEPARATOR);
  console.info(chalk.yellow('\n1. Open WhatsApp on your phone'));
  console.info(chalk.yellow('2. Tap Menu (⋮) or Settings'));
  console.info(chalk.yellow('3. Tap Linked Devices'));
  console.info(chalk.yellow('4. Tap Link with Phone Number'));
  console.info(chalk.yellow('5. Enter this code:\n'));
  console.info(chalk.bold.hex('#00FF00')(`              ${formattedCode}`));
  console.info('');
  console.info(chalk.yellow('   Copy and paste exactly as shown'));
  console.info(chalk.gray('   Code expires in ~1-2 minutes'));
  console.info(SEPARATOR + '\n');
}

/**
 * Validates and formats a phone number for pairing code authentication.
 *
 * @param phone - The phone number string.
 * @returns The formatted phone number with country code.
 * @throws Error if the phone number is invalid.
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