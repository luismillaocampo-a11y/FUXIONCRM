const fs = require('fs');
const path = require('path');

const appData = path.join(process.env.APPDATA || '', 'NutraFlow CRM', 'app_data.json');

if (fs.existsSync(appData)) {
  const data = JSON.parse(fs.readFileSync(appData, 'utf-8'));
  data.ai_rules = data.ai_rules || [];

  const existingCard = data.ai_rules.find(r => r.title && r.title.includes('Exclusión de Productos Ajenos'));

  if (!existingCard) {
    const newCard = {
      id: 'rule-' + Date.now(),
      title: 'Control de Catálogo y Exclusión de Productos Ajenos',
      instruction: 'Queda prohibido inventar que un suplemento Fuxion es ropa o un vehículo (ej: no digas que Vita Xtra T es un polo). Si el cliente consulta por prendas, polos, ropa, autos o productos ajenos a la salud, aclara amablemente que comercializas exclusivamente bebidas funcionales y suplementos de nutrición Fuxion.',
      category: 'Restricciones',
      is_active: 1
    };
    data.ai_rules.push(newCard);
    console.log('✅ Tarjeta visual de Regla de IA agregada a ai_rules en la base de datos.');
  } else {
    console.log('ℹ️ La tarjeta visual ya existía en ai_rules.');
  }

  fs.writeFileSync(appData, JSON.stringify(data, null, 2), 'utf-8');
  console.log('✅ app_data.json actualizado con éxito.');
}
