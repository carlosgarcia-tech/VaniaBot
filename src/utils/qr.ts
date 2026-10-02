import qrcode from 'qrcode-terminal';
import chalk from 'chalk';

const SEPARATOR = chalk.bold.cyan('═══════════════════════════════════════════════════');

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
