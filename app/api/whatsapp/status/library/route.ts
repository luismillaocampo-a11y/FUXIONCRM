import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const items = await db.getStatusLibraryItems();
    return NextResponse.json(items);
  } catch (error: any) {
    console.error('[API WhatsApp Status Library] GET Error:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener biblioteca de estados' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const body = await request.json();
    const { title, product_name, category, tags, media_url, media_type, caption, internal_notes } = body;

    if (!title || !media_url) {
      return NextResponse.json({ error: 'Título y URL del archivo multimedia son obligatorios' }, { status: 400 });
    }

    if (typeof title !== 'string' || typeof media_url !== 'string' || title.trim().length > 200) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    if (!/^https:\/\/\S{1,2048}$/.test(media_url) && !media_url.startsWith('/uploads/')) {
      return NextResponse.json({ error: 'media_url inválida (solo https o /uploads/)' }, { status: 400 });
    }

    const created = await db.createStatusLibraryItem({
      title: title.trim().slice(0, 200),
      product_name: typeof product_name === 'string' ? product_name.slice(0, 200) : '',
      category: typeof category === 'string' ? category.slice(0, 100) : 'General',
      tags: Array.isArray(tags) ? tags.filter((t) => typeof t === 'string').slice(0, 20) : [],
      media_url,
      media_type: media_type || (media_url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image'),
      caption: typeof caption === 'string' ? caption.slice(0, 1000) : '',
      internal_notes: typeof internal_notes === 'string' ? internal_notes.slice(0, 2000) : ''
    });

    return NextResponse.json({ success: true, item: created });
  } catch (error: any) {
    console.error('[API WhatsApp Status Library] POST Error:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar estado en la biblioteca' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el ID del elemento a eliminar' }, { status: 400 });
    }

    await db.deleteStatusLibraryItem(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API WhatsApp Status Library] DELETE Error:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar elemento de la biblioteca' }, { status: 500 });
  }
}
