import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateLeadsCSV } from '@/lib/export-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const leads = await db.getLeads();
    const excelContent = generateLeadsCSV(leads);

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Nutraflow_Clientes_${dateStr}.xls`;

    return new NextResponse(excelContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    console.error('[export API] Error al generar reporte Excel:', error);
    return NextResponse.json({ error: 'Fallo al generar el archivo de exportación' }, { status: 500 });
  }
}
