const fs = require('fs');
const path = require('path');

const appData = path.join(process.env.APPDATA || '', 'NutraFlow CRM', 'app_data.json');

if (fs.existsSync(appData)) {
  const data = JSON.parse(fs.readFileSync(appData, 'utf-8'));
  data.knowledge_base = data.knowledge_base || [];

  const existingScope = data.knowledge_base.find(k => k.title && k.title.toLowerCase().includes('alcance exclusivo'));

  if (!existingScope) {
    const scopeItem = {
      id: 'kb-scope-' + Date.now(),
      title: 'Alcance Exclusivo de Productos: Suplementos Nutricionales Fuxion',
      file_type: 'txt',
      content: 'Fuxion es una empresa dedicada exclusivamente a la venta de bebidas funcionales, tés, batidos y suplementos de salud (como Thermo T3, Vita Xtra T, Prunex 1, Flora Liv, Biopro Tect, etc.). Queda estrictamente excluido cualquier otro rubro comercial (vehículos, carros, tecnología, electrodomésticos, calzado, vestimenta, inmuebles, etc.). Si un cliente consulta por cualquier producto que no sea un suplemento o bebida de salud Fuxion, responde siempre aclarando que tu negocio es una distribuidora exclusiva de salud y nutrición Fuxion y ofrece amablemente el catálogo de suplementos de bienestar.',
      summary: 'Garantía de alcance exclusivo en suplementos de salud Fuxion y exclusión de cualquier producto ajeno (carros, tecnología, ropa, etc.).',
      file_path: null,
      created_at: new Date().toISOString()
    };
    data.knowledge_base.push(scopeItem);
    console.log('✅ Recurso de Alcance Exclusivo Fuxion agregado a la Biblioteca RAG.');
  }

  // Reforzar ai_rules con la exclusión universal de productos ajenos
  data.system_settings = data.system_settings || {};
  let rules = data.system_settings.ai_rules || '';

  const scopeRuleText = `
[REGLA DE ALCANCE EXCLUSIVO DE PRODUCTOS AJENOS]
Tu empresa comercializa ÚNICAMENTE suplementos nutricionales y bebidas de salud Fuxion. Si un cliente menciona cualquier producto ajeno a la salud (ej. carros, celulares, ropa, inmuebles), responde amablemente aclarando:
"En Fuxion nos especializamos exclusivamente en bebidas funcionales y suplementos para la salud y nutrición (como Thermo T3, Vita Xtra T, etc.). No comercializamos vehículos ni productos ajenos a la salud. ¿Te gustaría conocer nuestras opciones de nutrición y bienestar?"
`;

  if (!rules.includes('REGLA DE ALCANCE EXCLUSIVO')) {
    data.system_settings.ai_rules = rules + '\n\n' + scopeRuleText;
    console.log('✅ Regla de alcance exclusivo agregada a ai_rules.');
  }

  fs.writeFileSync(appData, JSON.stringify(data, null, 2), 'utf-8');
  console.log('✅ app_data.json actualizado con éxito.');
}
