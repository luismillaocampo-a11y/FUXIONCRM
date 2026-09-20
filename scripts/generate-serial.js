// Script Generador de Licencias Comerciales para NutraFlow CRM
// Uso: node scripts/generate-serial.js "Nombre de la Empresa" [HardwareID] [PRO|BASICO]

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

function generateLicenseSerial(companyName, plan = 'PRO', machineId = null) {
  const cleanCompany = companyName.trim().toUpperCase();
  const planTag = plan.toUpperCase() === 'PRO' ? 'PRO' : 'BAS';
  const hwId = (machineId || getLocalMachineHardwareId()).trim().toUpperCase();
  
  const payloadToSign = `${cleanCompany}:${planTag}:${hwId}`;
  const hmac = crypto.createHmac('sha256', MASTER_SECRET_KEY).update(payloadToSign).digest('hex').toUpperCase();

  const part1 = hmac.substring(0, 4);
  const part2 = hmac.substring(4, 8);
  const part3 = hmac.substring(8, 12);
  const part4 = hmac.substring(12, 16);

  return `NF-${planTag}-${part1}-${part2}-${part3}-${part4}`;
}

const args = process.argv.slice(2);
const companyInput = args[0] || 'EMPRESA DEMO';
const machineIdInput = args[1] || getLocalMachineHardwareId();
const planInput = args[2] || 'PRO';

const serial = generateLicenseSerial(companyInput, planInput, machineIdInput);

console.log('\n======================================================');
console.log('   GENERADOR DE LICENCIAS AMARRADAS A HARDWARE / PLACA');
console.log('======================================================');
console.log(` 🏢 Empresa:     "${companyInput.trim().toUpperCase()}"`);
console.log(` 💻 Hardware ID: "${machineIdInput.trim().toUpperCase()}"`);
console.log(` 💎 Plan:        ${planInput.toUpperCase()}`);
console.log(` 🔑 SERIAL:      ${serial}`);
console.log('======================================================\n');
