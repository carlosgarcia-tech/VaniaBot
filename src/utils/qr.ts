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
  console.info(chalk.bold.magenta('            ESCANEA EL CÓDIGO QR '));
  console.info(SEPARATOR);
  console.info(chalk.yellow('\n1. Abre WhatsApp en tu teléfono'));
  console.info(chalk.yellow('2. Toca Menú (⋮) o Configuración'));
  console.info(chalk.yellow('3. Toca Dispositivos vinculados'));
  console.info(chalk.yellow('4. Toca Vincular un dispositivo'));
  console.info(chalk.yellow('5. Escanea este código QR\n'));
  qrcode.generate(qr, { small: true });
  console.info(SEPARATOR);
  console.info(chalk.gray('💡 El código QR se actualiza automáticamente cada 20 segundos'));
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
  console.info(chalk.bold.magenta('        🔢 CÓDIGO DE PAREAMIENTO 🔢'));
  console.info(SEPARATOR);
  console.info(chalk.yellow('\n1. Abre WhatsApp en tu teléfono'));
  console.info(chalk.yellow('2. Toca Menú (⋮) o Configuración'));
  console.info(chalk.yellow('3. Toca Dispositivos vinculados'));
  console.info(chalk.yellow('4. Toca Vincular con número de teléfono'));
  console.info(chalk.yellow('5. Ingresa este código:\n'));
  console.info(chalk.bold.hex('#00FF00')(`              ${formattedCode}`));
  console.info('');
  console.info(chalk.yellow('   → Copia y pega exactamente como aparece'));
  console.info(chalk.gray('   ⚠️  El código expira en ~1-2 minutos'));
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
      `Número de teléfono inválido: ${phone}. Debe tener 10-15 dígitos (incluyendo código de país).`,
    );
  }

  return cleaned;
}
