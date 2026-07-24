/**
 * GENERADOR DE LICENCIAS OFICIAL - NUTRAFLOW CRM
 * Creado para: L. Milla (Desarrollador & Propietario)
 * 
 * Uso desde Terminal:
 *   node scripts/generate-license.js --empresa="Botica San Martín" --plan=PRO
 *   node scripts/generate-license.js --empresa="Farmacia MiSalud" --plan=BASICO
 */

const crypto = require('crypto');

const MASTER_SECRET_KEY = process.env.LICENSE_MASTER_SECRET || 'MILLA_NUTRAFLOW_CRM_SECRET_2026_PRO';

function generateSerial(companyName, plan) {
  const cleanCompany = companyName.trim().toUpperCase();
  const planTag = (plan || 'PRO').toUpperCase() === 'PRO' ? 'PRO' : 'BAS';
  
  const payloadToSign = `${cleanCompany}:${planTag}`;
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

args.forEach(arg => {
  if (arg.startsWith('--empresa=')) {
    companyName = arg.split('=')[1].replace(/^["']|["']$/g, '');
  } else if (arg.startsWith('--plan=')) {
    plan = arg.split('=')[1].replace(/^["']|["']$/g, '').toUpperCase();
  }
});

if (!companyName) {
  console.log('\n======================================================');
  console.log('  🔑 GENERADOR DE LICENCIAS COMERCIALES - L. MILLA');
  console.log('======================================================');
  console.log(' Error: Debes ingresar el nombre de la empresa compradora.');
  console.log('\n Ejemplo de uso:');
  console.log('   node scripts/generate-license.js --empresa="Botica San Martín" --plan=PRO');
  console.log('   node scripts/generate-license.js --empresa="Tienda Sol" --plan=BASICO\n');
  process.exit(1);
}

const serial = generateSerial(companyName, plan);

console.log('\n================================================================');
console.log('  🔑 LICENCIA COMERCIAL EMITIDA EXITOSAMENTE');
console.log('================================================================');
console.log(` 🏢 Empresa / Negocio: ${companyName.toUpperCase()}`);
console.log(` ⭐ Plan Comercial:    ${plan === 'PRO' ? 'PRO / PREMIUM (Todas las redes + Excel)' : 'BÁSICO (WhatsApp Bot)'}`);
console.log(` 🔑 SERIAL KEY:        ${serial}`);
console.log(' ✍️  Crédito Autor:      Desarrollado por L. Milla (Inamovible)');
console.log('================================================================');
console.log(' Entrega este SERIAL KEY a tu cliente para que active su CRM.\n');
