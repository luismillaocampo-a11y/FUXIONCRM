const fs = require('fs');
const path = require('path');

const appData = path.join(process.env.APPDATA || '', 'NutraFlow CRM', 'app_data.json');

if (fs.existsSync(appData)) {
  const data = JSON.parse(fs.readFileSync(appData, 'utf-8'));
  
  // 1. Agregar recurso RAG para Polos y Merchandising
  data.knowledge_base = data.knowledge_base || [];
  const existingPolo = data.knowledge_base.find(k => k.title && k.title.toLowerCase().includes('polo'));
  
  if (!existingPolo) {
    const newItem = {
      id: 'kb-' + Date.now(),
      title: 'Política de Productos: Merchandising, Polos y Ropa',
      file_type: 'txt',
      content: 'Fuxion es una empresa dedicada exclusivamente a la salud, bebidas funcionales y suplementos nutricionales (como Thermo T3, Vita Xtra T, Prunex 1, Flora Liv, Biopro Tect, etc.). NO comercializamos prendas de vestir, polos, camisetas, gorras ni merchandising. Si un cliente pregunta por polos, ropa o merch, aclara amablemente con la siguiente respuesta exacta: "Actualmente en Fuxion nos enfocamos exclusivamente en bebidas y suplementos para la salud y nutrición (como Thermo T3, Vita Xtra T, etc.). No comercializamos prendas de vestir ni polos. ¿Te gustaría conocer nuestras opciones nutricionales?"',
      summary: 'Aclaración de que Fuxion solo comercializa suplementos de salud y NO prendas de vestir, polos ni ropa.',
      file_path: null,
      created_at: new Date().toISOString()
    };
    data.knowledge_base.push(newItem);
    console.log('✅ Recurso de Polos / Merchandising agregado a la Biblioteca RAG.');
  } else {
    console.log('ℹ️ El recurso de Polos ya existía en RAG.');
  }

  // 2. Actualizar las reglas del sistema de la IA (ai_rules)
  data.system_settings = data.system_settings || {};
  let currentRules = data.system_settings.ai_rules || '';
  
  const antiHallucinationRules = `
[REGLAS ANTI-ALUCINACIÓN Y CONTROL DE CATÁLOGO]
1. NUNCA inventes que un suplemento nutricional es una prenda de vestir (ejemplo: NUNCA digas que 'Vita Xtra T' es un polo).
2. Si el cliente consulta por prendas de vestir, polos, ropa o merch, responde únicamente: "Actualmente en Fuxion nos enfocamos exclusivamente en bebidas y suplementos para la salud y nutrición (como Thermo T3, Vita Xtra T, etc.). No comercializamos prendas de vestir ni polos. ¿Te gustaría conocer nuestras opciones nutricionales?"
3. NUNCA uses la muletilla robótica "Te entiendo perfectamente" ni asumas que la primera palabra que escribe el cliente es su nombre de pila.
`;

  if (!currentRules.includes('REGLAS ANTI-ALUCINACIÓN')) {
    data.system_settings.ai_rules = currentRules + '\n\n' + antiHallucinationRules;
    console.log('✅ Reglas anti-alucinación actualizadas en ai_rules.');
  }

  fs.writeFileSync(appData, JSON.stringify(data, null, 2), 'utf-8');
  console.log('✅ Base de datos local app_data.json actualizada con éxito.');
} else {
  console.warn('⚠️ No se encontró el archivo app_data.json.');
}
