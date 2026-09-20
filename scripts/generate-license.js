/**
 * GENERADOR DE LICENCIAS OFICIAL - NUTRAFLOW CRM
 * Creado para: L. Milla (Desarrollador & Propietario)
 * 
 * Uso desde Terminal:
 *   node scripts/generate-license.js --empresa="Botica San Martín" --hardware="4F8A92B1C87E" --plan=PRO
 *   node scripts/generate-license.js --empresa="Farmacia MiSalud" --plan=BASICO
 */

const crypto = require('crypto');
const os = require('os');

const MASTER_SECRET_KEY = process.env.LICENSE_MASTER_SECRET || 'MILLA_NUTRAFLOW_CRM_SECRET_2026_PRO';

function getLocalMachineHardwareId() {
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'GENERIC_CPU';
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();

  const rawData = `${hostname}-${platform}-${arch}-${cpuModel}`;
  return crypto.createHash('md5').update(rawData).digest('hex').substring(0, 16).toUpperCase();
}

function generateSerial(companyName, plan, machineId) {
  const cleanCompany = companyName.trim().toUpperCase();
  const planTag = (plan || 'PRO').toUpperCase() === 'PRO' ? 'PRO' : 'BAS';
  const hwId = (machineId || getLocalMachineHardwareId()).trim().toUpperCase();
  
  const payloadToSign = `${cleanCompany}:${planTag}:${hwId}`;
  const hmac = crypto.createHmac('sha256', MASTER_SECRET_KEY).update(payloadToSign).digest('hex').toUpperCase();

  const part1 = hmac.substring(0, 4);
  const part2 = hmac.substring(4, 8);
  const part3 = hmac.substring(8, 12);
  const part4 = hmac.substring(12, 16);

  return `NF-${planTag}-${part1}-${part2}-${part3}-${part4}`;
}

// Extraer argumentos de la línea de comandos
const args = process.argv.slice(2);
let companyName = '';
let plan = 'PRO';
let hardwareId = '';

args.forEach(arg => {
  if (arg.startsWith('--empresa=')) {
    companyName = arg.split('=')[1].replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--plan=')) {
    plan = arg.split('=')[1].replace(/^["']|["']$/g, '').toUpperCase();
  } else if (arg.startsWith('--hardware=')) {
    hardwareId = arg.split('=')[1].replace(/^["']|["']$/g, '').toUpperCase();
  }
});

// Soporte para argumentos posicionales simples
if (!companyName && args[0]) {
  companyName = args[0];
  if (args[1]) hardwareId = args[1];
  if (args[2]) plan = args[2];
}

if (!companyName) {
  console.log('\n======================================================');
  console.log('  🔑 GENERADOR DE LICENCIAS COMERCIALES - L. MILLA');
  console.log('======================================================');
  console.log(' Error: Debes ingresar el nombre de la empresa compradora.');
  console.log('\n Ejemplo de uso:');
  console.log('   node scripts/generate-license.js --empresa="Botica San Martín" --hardware="4F8A92B1C87E" --plan=PRO');
  console.log('   node scripts/generate-license.js "Botica San Martín" "4F8A92B1C87E"\n');
  process.exit(1);
}

const targetHwId = hardwareId || getLocalMachineHardwareId();
const serial = generateSerial(companyName, plan, targetHwId);

console.log('\n================================================================');
console.log('  🔑 LICENCIA COMERCIAL EMITIDA EXITOSAMENTE');
console.log('================================================================');
console.log(` 🏢 Empresa / Negocio: ${companyName.toUpperCase()}`);
console.log(` 💻 ID Hardware (PC):  ${targetHwId}`);
console.log(` ⭐ Plan Comercial:    ${plan === 'PRO' ? 'PRO / PREMIUM (Todas las redes + Excel)' : 'BÁSICO (WhatsApp Bot)'}`);
console.log(` 🔑 SERIAL KEY:        ${serial}`);
console.log(' ✍️  Crédito Autor:      Desarrollado por L. Milla (Inamovible)');
console.log('================================================================');
console.log(' Entrega este SERIAL KEY a tu cliente para que active su CRM.\n');
