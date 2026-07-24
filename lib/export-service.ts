/**
 * Servicio de Exportación de Datos para Nutraflow CRM
 * Genera reportes en formato Hoja de Cálculo Estilizada (.xls) compatible con Microsoft Excel y Google Sheets
 * con encabezados verde esmeralda, bordes limpios y filas alternadas.
 */

export interface ExportLeadData {
  id: string;
  name: string;
  phone: string;
  status: string;
  bot_active: boolean | number;
  tags?: string[] | string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Traduce el código de estado interno a una etiqueta comercial en español.
 */
function translateStatus(status: string): string {
  switch (status) {
    case 'New':
      return 'Nuevo Prospecto';
    case 'Engaged':
      return 'En Conversación';
    case 'Pending Verification':
      return 'Verificación de Pago Pendiente';
    case 'Por Registrar en Web':
      return 'Por Registrar en Web';
    case 'Converted':
      return 'Venta Confirmada';
    default:
      return status || 'Sin Estado';
  }
}

/**
 * Genera una Hoja de Cálculo HTML (.xls) estilizada profesionalmente para Excel y Google Sheets.
 */
export function generateLeadsCSV(leads: ExportLeadData[]): string {
  const headers = [
    'ID / Teléfono',
    'Nombre del Cliente',
    'Celular WhatsApp',
    'Estado Comercial',
    'Modo del Bot',
    'Etiquetas de Interés',
    'Fecha de Registro',
    'Última Interacción'
  ];

  const headerCellsHtml = headers.map(h => 
    `<th style="background-color: #00a884; color: #ffffff; font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; padding: 10px 14px; text-align: left; border: 1px solid #008f70;">${h}</th>`
  ).join('');

  const rowsHtml = leads.map((lead, index) => {
    const cleanPhone = lead.phone ? lead.phone.replace(/\D/g, '') : lead.id;
    const formattedPhone = cleanPhone ? `+${cleanPhone}` : '';
    const statusText = translateStatus(lead.status);
    const botMode = Boolean(lead.bot_active) ? 'IA Automática' : 'Atención Manual';
    
    let tagsStr = '';
    try {
      const parsedTags = typeof lead.tags === 'string' ? JSON.parse(lead.tags) : lead.tags;
      tagsStr = Array.isArray(parsedTags) ? parsedTags.join(', ') : '';
    } catch (e) {
      tagsStr = String(lead.tags || '');
    }

    const createdAt = lead.created_at ? new Date(lead.created_at).toLocaleString('es-PE') : '';
    const updatedAt = lead.updated_at ? new Date(lead.updated_at).toLocaleString('es-PE') : '';

    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    const escapeXml = (str: string) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    return `
      <tr style="background-color: ${bgColor}; font-family: Arial, sans-serif; font-size: 11px;">
        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${escapeXml(lead.id)}</td>
        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${escapeXml(lead.name || 'Cliente sin nombre')}</td>
        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #0284c7; font-weight: bold;">${escapeXml(formattedPhone)}</td>
        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${escapeXml(statusText)}</td>
        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: ${lead.bot_active ? '#059669' : '#d97706'}; font-weight: bold;">${escapeXml(botMode)}</td>
        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #475569;">${escapeXml(tagsStr)}</td>
        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #64748b;">${escapeXml(createdAt)}</td>
        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #64748b;">${escapeXml(updatedAt)}</td>
      </tr>
    `;
  }).join('');

  // Estructura XML / HTML nativa que Microsoft Excel y Google Sheets abren con colores y formato impecable
  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Clientes Nutraflow</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
    </head>
    <body>
      <table border="1" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            ${headerCellsHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  return '\uFEFF' + htmlContent;
}
